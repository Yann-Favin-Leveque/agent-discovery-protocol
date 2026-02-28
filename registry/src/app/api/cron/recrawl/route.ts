import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedServices,
  updateServiceVerification,
  incrementCrawlFailure,
  markUnreachable,
} from "@/lib/db";
import { crawlService } from "@/lib/crawl";

const MAX_CONSECUTIVE_FAILURES = 3;

export async function GET(request: NextRequest) {
  // Optional auth token for cron security
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const services = getVerifiedServices();
  const results: Array<{
    domain: string;
    status: "ok" | "failed" | "unreachable";
    response_time_ms?: number;
    error?: string;
  }> = [];

  for (const service of services) {
    const crawl = await crawlService(service.domain);

    if (crawl.success && crawl.manifest) {
      const manifest = crawl.manifest;
      updateServiceVerification(service.domain, {
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

      results.push({
        domain: service.domain,
        status: "ok",
        response_time_ms: crawl.response_time_ms,
      });
    } else {
      incrementCrawlFailure(service.domain);
      const failures = service.crawl_failures + 1;

      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        markUnreachable(service.domain);
        results.push({
          domain: service.domain,
          status: "unreachable",
          error: `${failures} consecutive failures. Marked as unreachable.`,
        });
      } else {
        results.push({
          domain: service.domain,
          status: "failed",
          error: crawl.errors[0],
        });
      }
    }
  }

  const ok = results.filter((r) => r.status === "ok").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const unreachable = results.filter((r) => r.status === "unreachable").length;

  return NextResponse.json({
    success: true,
    data: {
      total: services.length,
      ok,
      failed,
      unreachable,
      results,
    },
  });
}
