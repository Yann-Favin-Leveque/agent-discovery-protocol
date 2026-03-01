import { NextRequest, NextResponse } from "next/server";
import {
  getVerifiedOnlyServices,
  updateServiceVerification,
  incrementCrawlFailure,
  markUnreachable,
  insertHealthCheck,
  cleanupOldHealthChecks,
} from "@/lib/db";
import { crawlService } from "@/lib/crawl";

const MAX_CONSECUTIVE_FAILURES = 3;

export async function GET(request: NextRequest) {
  // CRON_SECRET is mandatory — reject if not configured or wrong
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { success: false, error: "Unauthorized." },
      { status: 401 }
    );
  }

  const services = await getVerifiedOnlyServices();
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
      await updateServiceVerification(service.domain, {
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

      // Store health check: degraded if response > 5s
      const healthStatus = crawl.response_time_ms > 5000 ? "degraded" : "up";
      await insertHealthCheck({
        service_domain: service.domain,
        status: healthStatus,
        response_time_ms: crawl.response_time_ms,
      });

      results.push({
        domain: service.domain,
        status: "ok",
        response_time_ms: crawl.response_time_ms,
      });
    } else {
      await incrementCrawlFailure(service.domain);
      const failures = service.crawl_failures + 1;

      // Store health check as down
      await insertHealthCheck({
        service_domain: service.domain,
        status: "down",
        response_time_ms: crawl.response_time_ms,
      });

      if (failures >= MAX_CONSECUTIVE_FAILURES) {
        await markUnreachable(service.domain);
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

  // Cleanup health checks older than 30 days
  const cleaned = await cleanupOldHealthChecks();

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
      health_records_cleaned: cleaned,
      results,
    },
  });
}
