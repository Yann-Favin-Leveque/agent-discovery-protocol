import { NextResponse } from "next/server";
import { getOverallHealthStats, getLatestHealthChecks } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, latestChecks] = await Promise.all([
    getOverallHealthStats(),
    getLatestHealthChecks(),
  ]);

  const overallStatus =
    stats.down > 0 ? "degraded" : stats.degraded > 0 ? "degraded" : "healthy";

  return NextResponse.json({
    success: true,
    data: {
      status: overallStatus,
      ...stats,
      services: latestChecks.map((check) => ({
        domain: check.service_domain,
        status: check.status,
        response_time_ms: check.response_time_ms,
        checked_at: check.checked_at,
      })),
    },
  });
}
