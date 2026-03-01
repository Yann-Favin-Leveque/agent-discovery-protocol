import { NextRequest, NextResponse } from "next/server";
import {
  getServiceByDomain,
  updateServiceVerification,
  incrementCrawlFailure,
  logAudit,
} from "@/lib/db";
import { crawlService } from "@/lib/crawl";
import { getClientIp } from "@/lib/sanitize";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function POST(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:verify`, RATE_LIMITS.verifyService);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  try {
    const service = await getServiceByDomain(params.domain);
    if (!service) {
      return NextResponse.json(
        { success: false, error: `Service '${params.domain}' not found.` },
        { status: 404 }
      );
    }

    const crawl = await crawlService(params.domain);

    if (!crawl.success || !crawl.manifest) {
      await incrementCrawlFailure(params.domain);
      await logAudit({
        action: "service_verification_failed",
        domain: params.domain,
        ip_address: ip,
        details: JSON.stringify({ errors: crawl.errors }),
      });
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

    const verified = crawl.detail_url_ok !== false;
    const manifest = crawl.manifest;

    if (verified) {
      await updateServiceVerification(params.domain, {
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

    await logAudit({
      action: verified ? "service_verified" : "service_verification_failed",
      domain: params.domain,
      ip_address: ip,
      details: JSON.stringify({
        verified,
        detail_url_ok: crawl.detail_url_ok,
        response_time_ms: crawl.response_time_ms,
      }),
    });

    return NextResponse.json({
      success: true,
      data: {
        domain: params.domain,
        verified,
        trust_level: verified ? "verified" : service.trust_level,
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
