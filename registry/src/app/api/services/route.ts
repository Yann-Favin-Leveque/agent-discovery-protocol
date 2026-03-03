import { NextRequest, NextResponse } from "next/server";
import {
  getAllServices,
  insertService,
  getServiceByDomain,
  isBlockedDomain,
  logAudit,
} from "@/lib/db";
import { validateManifest, extractDomain, flattenErrors } from "@/lib/validate";
import { crawlService } from "@/lib/crawl";
import { sanitizeSearch, getClientIp, isValidDomain } from "@/lib/sanitize";
import { isDomainBlocked } from "@/lib/blocklist";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:list`, RATE_LIMITS.listServices);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? undefined;
  const rawSearch = params.get("search") ?? undefined;
  const search = rawSearch ? sanitizeSearch(rawSearch) : undefined;
  const sort = (params.get("sort") as "newest" | "name" | "capabilities") ?? "newest";
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 100);
  const offset = parseInt(params.get("offset") ?? "0", 10);
  const includeUnverified = params.get("include_unverified") === "true";

  try {
    const { services, total } = await getAllServices({
      category,
      search,
      sort,
      limit,
      offset,
      include_unverified: includeUnverified,
    });

    const page = Math.floor(offset / limit) + 1;
    const totalPages = Math.max(1, Math.ceil(total / limit));

    const data = services.map((s) => ({
      name: s.name,
      domain: s.domain,
      description: s.description,
      base_url: s.base_url,
      auth_type: s.auth_type,
      pricing_type: s.pricing_type,
      verified: s.trust_level === "verified",
      trust_level: s.trust_level,
      capability_count: s.cap_count,
      category: s.category_slug ?? null,
      created_at: s.created_at,
    }));

    return NextResponse.json({
      success: true,
      data,
      total,
      page,
      totalPages,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:submit`, RATE_LIMITS.submitService);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  // Mode 1: auto-discover by domain
  if (typeof body.domain === "string" && !body.manifest) {
    const domain = body.domain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");

    if (!domain || domain.length < 3 || !isValidDomain(domain)) {
      return NextResponse.json(
        { success: false, error: "Invalid domain format." },
        { status: 400 }
      );
    }

    // Check admin-blocked domains (blocks both modes)
    if (await isBlockedDomain(domain)) {
      return NextResponse.json(
        { success: false, error: "This domain has been blocked by an administrator." },
        { status: 403 }
      );
    }

    const existing = await getServiceByDomain(domain);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Service '${domain}' is already registered.` },
        { status: 409 }
      );
    }

    const crawl = await crawlService(domain);
    if (!crawl.success || !crawl.manifest) {
      await logAudit({
        action: "validation_failed",
        domain,
        ip_address: ip,
        details: JSON.stringify({ mode: "auto-discover", errors: crawl.errors }),
      });
      return NextResponse.json(
        { success: false, errors: crawl.errors },
        { status: 422 }
      );
    }

    const manifest = crawl.manifest;
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
      trust_level: "verified",
      setup_guide: body.setup_guide ?? undefined,
      capabilities: manifest.capabilities.map((c) => ({
        name: c.name,
        description: c.description,
        detail_url: c.detail_url,
      })),
    });

    await logAudit({
      action: "service_submitted",
      domain,
      ip_address: ip,
      details: JSON.stringify({ mode: "auto-discover", trust_level: "verified" }),
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: service.domain,
        name: service.name,
        trust_level: "verified",
        verified: true,
        detail_url_ok: crawl.detail_url_ok,
        response_time_ms: crawl.response_time_ms,
        message: "Service discovered and registered successfully.",
      },
    }, { status: 201 });
  }

  // Mode 2: manual manifest paste
  if (body.manifest && typeof body.manifest === "object") {
    const validation = validateManifest(body.manifest);
    if (!validation.valid || !validation.manifest) {
      await logAudit({
        action: "validation_failed",
        ip_address: ip,
        details: JSON.stringify({ mode: "manual", errors: flattenErrors(validation.errors) }),
      });
      return NextResponse.json(
        { success: false, errors: flattenErrors(validation.errors) },
        { status: 422 }
      );
    }

    const manifest = validation.manifest;
    const domain = extractDomain(manifest.base_url);

    if (!isValidDomain(domain)) {
      return NextResponse.json(
        { success: false, error: "Invalid domain format in base_url." },
        { status: 400 }
      );
    }

    // Check admin-blocked domains
    if (await isBlockedDomain(domain)) {
      return NextResponse.json(
        { success: false, error: "This domain has been blocked by an administrator." },
        { status: 403 }
      );
    }

    // Check static blocklist (manual mode only)
    if (isDomainBlocked(domain)) {
      return NextResponse.json(
        { success: false, error: "This domain is protected. Only auto-discovery from the live /.well-known/agent endpoint can register this service." },
        { status: 403 }
      );
    }

    const existing = await getServiceByDomain(domain);
    if (existing) {
      // Cannot overwrite verified or community services via manual submission
      if (existing.trust_level === "verified" || existing.trust_level === "community") {
        return NextResponse.json(
          { success: false, error: `Service '${domain}' is already registered as ${existing.trust_level}. It cannot be overwritten by manual submission.` },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: `Service '${domain}' is already registered.` },
        { status: 409 }
      );
    }

    const capabilityDetails = (body.capability_details as Record<string, unknown>) ?? {};

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
      trust_level: "unverified",
      setup_guide: body.setup_guide ?? undefined,
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
      ip_address: ip,
      details: JSON.stringify({ mode: "manual", trust_level: "unverified" }),
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: service.domain,
        name: service.name,
        trust_level: "unverified",
        verified: false,
        message: "Service registered from manifest. Not yet verified — use the verify button to crawl the live endpoint.",
      },
    }, { status: 201 });
  }

  return NextResponse.json(
    { success: false, error: "Request must include either 'domain' (string) or 'manifest' (object)." },
    { status: 400 }
  );
}
