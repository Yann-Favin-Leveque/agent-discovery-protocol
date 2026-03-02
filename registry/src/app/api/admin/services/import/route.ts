import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { insertService, getServiceByDomain, upsertCapabilityDetail, replaceServiceCapabilities, logAudit } from "@/lib/db";
import type { TrustLevel } from "@/lib/db";
import { validateManifest, extractDomain, flattenErrors } from "@/lib/validate";
import { getClientIp } from "@/lib/sanitize";

/**
 * POST /api/admin/services/import
 *
 * Admin-only bulk import endpoint. Bypasses:
 *  - Rate limiting
 *  - Domain blocklist
 *  - Protected domain checks
 *
 * Body: { manifest: object, trust_level?: "community" | "verified" | "unverified", capability_details?: Record<string, object> }
 * Auth: Bearer ADMIN_SECRET
 */
export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.manifest || typeof body.manifest !== "object") {
    return NextResponse.json(
      { success: false, error: "Request must include 'manifest' (object)." },
      { status: 400 }
    );
  }

  const trustLevel = (body.trust_level as TrustLevel) || "community";
  if (!["verified", "community", "unverified"].includes(trustLevel)) {
    return NextResponse.json(
      { success: false, error: "trust_level must be verified, community, or unverified." },
      { status: 400 }
    );
  }

  const validation = validateManifest(body.manifest);
  if (!validation.valid || !validation.manifest) {
    return NextResponse.json(
      { success: false, errors: flattenErrors(validation.errors) },
      { status: 422 }
    );
  }

  const manifest = validation.manifest;
  const domain = extractDomain(manifest.base_url);
  const capabilityDetails = (body.capability_details as Record<string, unknown>) ?? {};

  // Skip blocklist check — admin can import anything

  const existing = await getServiceByDomain(domain);
  if (existing) {
    return NextResponse.json(
      { success: false, error: `Service '${domain}' already exists (trust_level: ${existing.trust_level}).`, existing: true },
      { status: 409 }
    );
  }

  const service = await insertService({
    name: manifest.name,
    domain,
    description: manifest.description,
    base_url: manifest.base_url,
    well_known_url: `https://${domain}/.well-known/agent`,
    auth_type: manifest.auth.type,
    auth_details: JSON.stringify(manifest.auth),
    pricing_type: manifest.pricing?.type ?? "free",
    spec_version: manifest.spec_version,
    trust_level: trustLevel,
    capabilities: manifest.capabilities.map((c) => ({
      name: c.name,
      description: c.description,
      detail_url: c.detail_url,
      detail_json: capabilityDetails[c.name] ?? undefined,
    })),
  });

  await logAudit({
    action: "service_submitted",
    domain,
    ip_address: getClientIp(request),
    details: JSON.stringify({ mode: "admin-import", trust_level: trustLevel }),
  });

  return NextResponse.json({
    success: true,
    data: {
      domain: service.domain,
      name: service.name,
      trust_level: trustLevel,
    },
  }, { status: 201 });
}

/**
 * PATCH /api/admin/services/import
 *
 * Update capability details for an existing service.
 * Used by the re-import script to push detail_json for all capabilities.
 *
 * Body: { domain: string, capability_details: Record<string, object> }
 * Auth: Bearer ADMIN_SECRET
 */
export async function PATCH(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const domain = body.domain as string;
  const capabilityDetails = body.capability_details as Record<string, unknown>;

  if (!domain || !capabilityDetails || typeof capabilityDetails !== "object") {
    return NextResponse.json(
      { success: false, error: "Request must include 'domain' (string) and 'capability_details' (object)." },
      { status: 400 }
    );
  }

  const service = await getServiceByDomain(domain);
  if (!service) {
    return NextResponse.json(
      { success: false, error: `Service '${domain}' not found.` },
      { status: 404 }
    );
  }

  let updated = 0;
  for (const [name, detail] of Object.entries(capabilityDetails)) {
    const ok = await upsertCapabilityDetail(service.id, name, detail);
    if (ok) updated++;
  }

  return NextResponse.json({
    success: true,
    data: { domain, capabilities_updated: updated },
  });
}

/**
 * PUT /api/admin/services/import
 *
 * Full replacement of a service's capabilities.
 * If the service exists, replaces all capabilities with the new set.
 * If it does not exist, creates it via insertService().
 *
 * Body: { manifest: object, trust_level?: "verified" | "community" | "unverified", capability_details?: Record<string, object> }
 * Auth: Bearer ADMIN_SECRET
 */
export async function PUT(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  if (!body.manifest || typeof body.manifest !== "object") {
    return NextResponse.json(
      { success: false, error: "Request must include 'manifest' (object)." },
      { status: 400 }
    );
  }

  const trustLevel = (body.trust_level as TrustLevel) || "community";
  if (!["verified", "community", "unverified"].includes(trustLevel)) {
    return NextResponse.json(
      { success: false, error: "trust_level must be verified, community, or unverified." },
      { status: 400 }
    );
  }

  const validation = validateManifest(body.manifest);
  if (!validation.valid || !validation.manifest) {
    return NextResponse.json(
      { success: false, errors: flattenErrors(validation.errors) },
      { status: 422 }
    );
  }

  const manifest = validation.manifest;
  const domain = extractDomain(manifest.base_url);
  const capabilityDetails = (body.capability_details as Record<string, unknown>) ?? {};

  // Pull resource_group from the raw body manifest capabilities (not in the validated type)
  const rawCapabilities = (body.manifest as Record<string, unknown>).capabilities as Array<Record<string, unknown>> | undefined;

  const capabilities = manifest.capabilities.map((cap, i) => ({
    name: cap.name,
    description: cap.description,
    detail_url: cap.detail_url,
    detail_json: capabilityDetails[cap.name] ?? undefined,
    resource_group: (rawCapabilities?.[i]?.resource_group as string) ?? undefined,
  }));

  try {
    const existing = await getServiceByDomain(domain);

    if (existing) {
      // Replace all capabilities for the existing service
      const updated = await replaceServiceCapabilities(
        domain,
        {
          name: manifest.name,
          description: manifest.description,
          base_url: manifest.base_url,
          auth_type: manifest.auth.type,
          auth_details: JSON.stringify(manifest.auth),
          pricing_type: manifest.pricing?.type ?? "free",
          spec_version: manifest.spec_version,
        },
        capabilities,
        trustLevel
      );

      if (!updated) {
        return NextResponse.json(
          { success: false, error: `Failed to replace capabilities for '${domain}'.` },
          { status: 500 }
        );
      }

      await logAudit({
        action: "service_submitted",
        domain,
        ip_address: getClientIp(request),
        details: JSON.stringify({ mode: "admin-import-replace", trust_level: trustLevel }),
      });

      return NextResponse.json({
        success: true,
        domain,
        capabilities_count: capabilities.length,
      });
    } else {
      // Service does not exist — create it
      const service = await insertService({
        name: manifest.name,
        domain,
        description: manifest.description,
        base_url: manifest.base_url,
        well_known_url: `https://${domain}/.well-known/agent`,
        auth_type: manifest.auth.type,
        auth_details: JSON.stringify(manifest.auth),
        pricing_type: manifest.pricing?.type ?? "free",
        spec_version: manifest.spec_version,
        trust_level: trustLevel,
        capabilities: capabilities,
      });

      await logAudit({
        action: "service_submitted",
        domain,
        ip_address: getClientIp(request),
        details: JSON.stringify({ mode: "admin-import-create", trust_level: trustLevel }),
      });

      return NextResponse.json({
        success: true,
        domain: service.domain,
        capabilities_count: capabilities.length,
      });
    }
  } catch (err) {
    console.error("PUT /api/admin/services/import error:", err);
    return NextResponse.json(
      { success: false, error: "Internal server error during capability replacement." },
      { status: 500 }
    );
  }
}
