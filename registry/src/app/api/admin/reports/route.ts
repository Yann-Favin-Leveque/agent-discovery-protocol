import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { getReports } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const status = params.get("status") as "pending" | "resolved" | null;
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 200);
  const offset = parseInt(params.get("offset") ?? "0", 10);

  const { reports, total } = await getReports({
    status: status ?? undefined,
    limit,
    offset,
  });

  return NextResponse.json({
    success: true,
    data: reports,
    pagination: { total, limit, offset },
  });
}
