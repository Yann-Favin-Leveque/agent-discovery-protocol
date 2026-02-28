import { NextRequest, NextResponse } from "next/server";
import {
  getServiceByDomain,
  updateServiceVerification,
  incrementCrawlFailure,
} from "@/lib/db";
import { crawlService } from "@/lib/crawl";

export async function POST(
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

    const crawl = await crawlService(params.domain);

    if (!crawl.success || !crawl.manifest) {
      incrementCrawlFailure(params.domain);
      return NextResponse.json(
        {
          success: false,
          errors: crawl.errors,
          response_time_ms: crawl.response_time_ms,
          crawl_failures: service.crawl_failures + 1,
        },
        { status: 422 }
      );
    }

    // Verification criteria:
    // 1. /.well-known/agent responds with valid JSON ✓ (crawl succeeded)
    // 2. Manifest passes validation ✓ (crawlService validates)
    // 3. At least one detail_url resolves
    const verified = crawl.detail_url_ok !== false; // true or undefined (no caps) counts as verified

    const manifest = crawl.manifest;

    if (verified) {
      updateServiceVerification(params.domain, {
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
    }

    return NextResponse.json({
      success: true,
      data: {
        domain: params.domain,
        verified,
        detail_url_ok: crawl.detail_url_ok,
        response_time_ms: crawl.response_time_ms,
        message: verified
          ? "Service verified successfully. Manifest updated from live endpoint."
          : "Manifest is valid but no detail_url could be reached. Service marked as unverified.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
