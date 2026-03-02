import { NextRequest, NextResponse } from "next/server";
import {
  getServiceByDomain,
  getCapabilitiesForService,
} from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const service = await getServiceByDomain(params.domain);
    if (!service) {
      return NextResponse.json(
        { success: false, error: `Service '${params.domain}' not found.` },
        { status: 404 }
      );
    }

    const capabilities = await getCapabilitiesForService(service.id);
    const includeDetails = _request.nextUrl.searchParams.get("include_details") === "true";

    const manifest = {
      spec_version: service.spec_version,
      name: service.name,
      description: service.description,
      base_url: service.base_url,
      auth: JSON.parse(service.auth_details),
      pricing: { type: service.pricing_type },
      capabilities: capabilities.map((c) => ({
        name: c.name,
        description: c.description,
        detail_url: c.detail_url,
        ...(c.resource_group ? { resource_group: c.resource_group } : {}),
        ...(includeDetails && c.detail_json ? { detail: c.detail_json } : {}),
      })),
    };

    return NextResponse.json({
      success: true,
      data: {
        domain: service.domain,
        well_known_url: service.well_known_url,
        verified: service.trust_level === "verified",
        trust_level: service.trust_level,
        crawl_failures: service.crawl_failures,
        last_crawled_at: service.last_crawled_at,
        created_at: service.created_at,
        updated_at: service.updated_at,
        manifest,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
