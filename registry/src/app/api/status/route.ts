import { NextResponse } from "next/server";
import {
  getOverallHealthStats,
  getLatestHealthChecks,
  getUptimePercentage,
  getTrustedServices,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, latestChecks, trustedServices] = await Promise.all([
    getOverallHealthStats(),
    getLatestHealthChecks(),
    getTrustedServices(),
  ]);

  // Build a domain->latest health check map
  const healthMap = new Map(
    latestChecks.map((h) => [h.service_domain, h])
  );

  // Compute uptime for each service
  const services = await Promise.all(
    trustedServices.map(async (s) => {
      const health = healthMap.get(s.domain);
      const uptime = await getUptimePercentage(s.domain, 7);
      return {
        domain: s.domain,
        name: s.name,
        status: health?.status ?? "unknown",
        response_time_ms: health?.response_time_ms ?? null,
        uptime_percentage: uptime,
        last_checked: health?.checked_at ?? null,
        trust_level: s.trust_level,
      };
    })
  );

  // Sort: down first, then degraded, then up
  services.sort((a, b) => {
    const order: Record<string, number> = { down: 0, degraded: 1, unknown: 2, up: 3 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  return NextResponse.json({
    success: true,
    data: {
      overall_status:
        stats.down > 0 ? "down" : stats.degraded > 0 ? "degraded" : "healthy",
      ...stats,
      services,
      last_updated: new Date().toISOString(),
    },
  });
}
