import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { getAllServices } from "@/lib/db";
import type { TrustLevel } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const trustLevel = params.get("trust_level") as TrustLevel | null;
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 200);
  const offset = parseInt(params.get("offset") ?? "0", 10);

  const includeUnverified = !trustLevel || trustLevel === "unverified";

  const { services, total } = await getAllServices({
    sort: "newest",
    limit,
    offset,
    include_unverified: includeUnverified,
  });

  const filtered = trustLevel
    ? services.filter((s) => s.trust_level === trustLevel)
    : services;

  return NextResponse.json({
    success: true,
    data: filtered.map((s) => ({
      domain: s.domain,
      name: s.name,
      trust_level: s.trust_level,
      crawl_failures: s.crawl_failures,
      created_at: s.created_at,
      updated_at: s.updated_at,
    })),
    pagination: { total, limit, offset },
  });
}
