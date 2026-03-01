import { NextResponse } from "next/server";
import {
  getOverallHealthStats,
  getLatestHealthChecks,
  getUptimePercentage,
  getVerifiedOnlyServices,
  getTrustedServices,
} from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const [stats, latestChecks, verifiedServices, trustedServices] = await Promise.all([
    getOverallHealthStats(),
    getLatestHealthChecks(),
    getVerifiedOnlyServices(),
    getTrustedServices(),
  ]);

  // Build a domain->latest health check map
  const healthMap = new Map(
    latestChecks.map((h) => [h.service_domain, h])
  );

  // Compute uptime for verified services (health-monitored)
  const verifiedWithHealth = await Promise.all(
    verifiedServices.map(async (s) => {
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

  // Community services — no health monitoring
  const communityServices = trustedServices
    .filter((s) => s.trust_level === "community")
    .map((s) => ({
      domain: s.domain,
      name: s.name,
      status: "not_monitored" as const,
      response_time_ms: null,
      uptime_percentage: 0,
      last_checked: null,
      trust_level: s.trust_level,
    }));

  const services = [...verifiedWithHealth, ...communityServices];

  // Sort: down first, then degraded, then unknown, then not_monitored, then up
  services.sort((a, b) => {
    const order: Record<string, number> = { down: 0, degraded: 1, unknown: 2, not_monitored: 3, up: 4 };
    return (order[a.status] ?? 2) - (order[b.status] ?? 2);
  });

  return NextResponse.json({
    success: true,
    data: {
      overall_status:
        stats.down > 0 ? "down" : stats.degraded > 0 ? "degraded" : "healthy",
      ...stats,
      total_monitored: verifiedServices.length,
      services,
      last_updated: new Date().toISOString(),
    },
  });
}
