import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { blockDomain, deleteService, logAudit } from "@/lib/db";
import { getClientIp } from "@/lib/sanitize";

export async function PUT(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "Invalid JSON body." },
      { status: 400 }
    );
  }

  const reason = typeof body.reason === "string" ? body.reason.trim() : "Blocked by admin";

  await blockDomain(params.domain, reason, "admin");
  await deleteService(params.domain);

  await logAudit({
    action: "service_blocked",
    domain: params.domain,
    ip_address: getClientIp(request),
    details: JSON.stringify({ reason }),
  });

  return NextResponse.json({
    success: true,
    data: {
      domain: params.domain,
      message: "Domain blocked and service removed.",
    },
  });
}
