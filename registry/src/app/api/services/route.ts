import { NextRequest, NextResponse } from "next/server";
import {
  getAllServices,
  getCapabilitiesForService,
  insertService,
  getServiceByDomain,
} from "@/lib/db";
import { validateManifest, extractDomain, flattenErrors } from "@/lib/validate";
import { crawlService } from "@/lib/crawl";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const category = params.get("category") ?? undefined;
  const search = params.get("search") ?? undefined;
  const sort = (params.get("sort") as "newest" | "name" | "capabilities") ?? "newest";
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 100);
  const offset = parseInt(params.get("offset") ?? "0", 10);

  try {
    const { services, total } = await getAllServices({ category, search, sort, limit, offset });

    const data = await Promise.all(services.map(async (s) => {
      const caps = await getCapabilitiesForService(s.id);
      return {
        name: s.name,
        domain: s.domain,
        description: s.description,
        base_url: s.base_url,
        auth_type: s.auth_type,
        pricing_type: s.pricing_type,
        verified: !!s.verified,
        capability_count: caps.length,
        created_at: s.created_at,
      };
    }));

    return NextResponse.json({
      success: true,
      data,
      pagination: { total, limit, offset },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
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

    if (!domain || domain.length < 3) {
      return NextResponse.json(
        { success: false, error: "Invalid domain." },
        { status: 400 }
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
      verified: true,
      capabilities: manifest.capabilities.map((c) => ({
        name: c.name,
        description: c.description,
        detail_url: c.detail_url,
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: service.domain,
        name: service.name,
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
      return NextResponse.json(
        { success: false, errors: flattenErrors(validation.errors) },
        { status: 422 }
      );
    }

    const manifest = validation.manifest;
    const domain = extractDomain(manifest.base_url);

    const existing = await getServiceByDomain(domain);
    if (existing) {
      return NextResponse.json(
        { success: false, error: `Service '${domain}' is already registered.` },
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
      verified: false,
      capabilities: manifest.capabilities.map((c) => ({
        name: c.name,
        description: c.description,
        detail_url: c.detail_url,
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: service.domain,
        name: service.name,
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
