import { NextRequest, NextResponse } from "next/server";
import {
  getHealthChecksByDomain,
  getUptimePercentage,
  getServiceByDomain,
} from "@/lib/db";

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
