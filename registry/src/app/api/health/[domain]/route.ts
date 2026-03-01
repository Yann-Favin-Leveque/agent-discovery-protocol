import { NextRequest, NextResponse } from "next/server";
import {
  getHealthChecksByDomain,
  getUptimePercentage,
  getServiceByDomain,
  insertHealthCheck,
} from "@/lib/db";
import { crawlService } from "@/lib/crawl";
import { getClientIp } from "@/lib/sanitize";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  const service = await getServiceByDomain(params.domain);
  if (!service) {
    return NextResponse.json(
      { success: false, error: "Service not found." },
      { status: 404 }
    );
  }

  const searchParams = request.nextUrl.searchParams;
  const days = Math.min(Number(searchParams.get("days")) || 7, 30);

  const [checks, uptime] = await Promise.all([
    getHealthChecksByDomain(params.domain, days),
    getUptimePercentage(params.domain, days),
  ]);

  const latestCheck = checks.length > 0 ? checks[checks.length - 1] : null;

  return NextResponse.json({
    success: true,
    data: {
      domain: params.domain,
      name: service.name,
      current_status: latestCheck?.status ?? "unknown",
      response_time_ms: latestCheck?.response_time_ms ?? null,
      uptime_percentage: uptime,
      last_checked: latestCheck?.checked_at ?? null,
      history: checks.map((c) => ({
        status: c.status,
        response_time_ms: c.response_time_ms,
        checked_at: c.checked_at,
      })),
    },
  });
}

/**
 * POST /api/health/[domain]
 * Trigger a manual health check for a verified service.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:health-check`, RATE_LIMITS.verifyService);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const service = await getServiceByDomain(params.domain);
  if (!service) {
    return NextResponse.json(
      { success: false, error: "Service not found." },
      { status: 404 }
    );
  }

  if (service.trust_level !== "verified") {
    return NextResponse.json(
      { success: false, error: "Health checks are only available for verified services." },
      { status: 400 }
    );
  }

  const crawl = await crawlService(params.domain);
  const status = !crawl.success ? "down" : crawl.response_time_ms > 5000 ? "degraded" : "up";

  await insertHealthCheck({
    service_domain: params.domain,
    status,
    response_time_ms: crawl.response_time_ms,
  });

  return NextResponse.json({
    success: true,
    data: {
      domain: params.domain,
      status,
      response_time_ms: crawl.response_time_ms,
    },
  });
}
