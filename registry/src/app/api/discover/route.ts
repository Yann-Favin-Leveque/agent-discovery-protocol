import { NextRequest, NextResponse } from "next/server";
import { discoverServices } from "@/lib/db";
import { sanitizeSearch, getClientIp } from "@/lib/sanitize";
import { checkRateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export async function GET(request: NextRequest) {
  const ip = getClientIp(request);
  const rl = checkRateLimit(`${ip}:discover`, RATE_LIMITS.discover);
  if (!rl.allowed) {
    return NextResponse.json(
      { success: false, error: "Rate limit exceeded. Try again later." },
      { status: 429, headers: { "Retry-After": String(rl.retryAfterSec) } }
    );
  }

  const rawQ = request.nextUrl.searchParams.get("q")?.trim();
  if (!rawQ) {
    return NextResponse.json(
      { success: false, error: "Missing required query parameter 'q'. Example: /api/discover?q=send+email" },
      { status: 400 }
    );
  }

  const q = sanitizeSearch(rawQ);
  const includeUnverified = request.nextUrl.searchParams.get("include_unverified") === "true";

  const limit = Math.min(parseInt(request.nextUrl.searchParams.get("limit") ?? "10", 10), 50);

  try {
    const results = await discoverServices(q, { include_unverified: includeUnverified, limit });

    const data = results.map((service) => ({
      service: {
        name: service.name,
        domain: service.domain,
        description: service.description,
        base_url: service.base_url,
        auth_type: service.auth_type,
        pricing_type: service.pricing_type,
        verified: service.trust_level === "verified",
        trust_level: service.trust_level,
        cap_count: service.cap_count,
      },
      matching_capabilities: service.matching_capabilities.map((cap) => ({
        name: cap.name,
        description: cap.description,
        detail_url: cap.detail_url.startsWith("http")
          ? cap.detail_url
          : `${service.base_url}${cap.detail_url}`,
      })),
    }));

    return NextResponse.json({
      success: true,
      query: q,
      result_count: data.length,
      data,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : "Internal error" },
      { status: 500 }
    );
  }
}
