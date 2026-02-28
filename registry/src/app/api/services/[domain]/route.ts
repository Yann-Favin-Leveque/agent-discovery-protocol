import { NextRequest, NextResponse } from "next/server";
import {
  getServiceByDomain,
  getCapabilitiesForService,
  updateServiceVerification,
} from "@/lib/db";
import { crawlWellKnown } from "@/lib/crawl";

export async function GET(
  _request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const service = getServiceByDomain(params.domain);
    if (!service) {
      return NextResponse.json(
        { success: false, error: `Service '${params.domain}' not found.` },
        { status: 404 }
      );
    }

    const capabilities = getCapabilitiesForService(service.id);

    // Reconstruct the manifest format
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
      })),
    };

    return NextResponse.json({
      success: true,
      data: {
        domain: service.domain,
        well_known_url: service.well_known_url,
        verified: !!service.verified,
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

export async function POST(
  _request: NextRequest,
  { params }: { params: { domain: string } }
) {
  // Verify endpoint: re-crawl the /.well-known/agent and update
  try {
    const service = getServiceByDomain(params.domain);
    if (!service) {
      return NextResponse.json(
        { success: false, error: `Service '${params.domain}' not found.` },
        { status: 404 }
      );
    }

    const crawl = await crawlWellKnown(params.domain);
    if (!crawl.success || !crawl.manifest) {
      return NextResponse.json(
        { success: false, errors: crawl.errors },
        { status: 422 }
      );
    }

    const manifest = crawl.manifest;
    const updated = updateServiceVerification(params.domain, {
      name: manifest.name,
      description: manifest.description,
      base_url: manifest.base_url,
      auth_type: manifest.auth.type,
      auth_details: JSON.stringify(manifest.auth),
      pricing_type: manifest.pricing?.type ?? "free",
      spec_version: manifest.spec_version,
      capabilities: manifest.capabilities.map((c) => ({
        name: c.name,
        description: c.description,
        detail_url: c.detail_url,
      })),
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: updated?.domain,
        verified: true,
        message: "Service verified successfully. Manifest updated from live endpoint.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
