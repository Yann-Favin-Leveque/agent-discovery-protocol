import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { getAuditLog } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const params = request.nextUrl.searchParams;
  const action = params.get("action") ?? undefined;
  const domain = params.get("domain") ?? undefined;
  const limit = Math.min(parseInt(params.get("limit") ?? "50", 10), 200);
  const offset = parseInt(params.get("offset") ?? "0", 10);

  const { entries, total } = await getAuditLog({ action, domain, limit, offset });

  return NextResponse.json({
    success: true,
    data: entries,
    pagination: { total, limit, offset },
  });
}
