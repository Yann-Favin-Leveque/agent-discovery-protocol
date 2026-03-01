import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { deleteService, logAudit } from "@/lib/db";
import { getClientIp } from "@/lib/sanitize";

export async function DELETE(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  const deleted = await deleteService(params.domain);
  if (!deleted) {
    return NextResponse.json(
      { success: false, error: `Service '${params.domain}' not found.` },
      { status: 404 }
    );
  }

  await logAudit({
    action: "service_deleted",
    domain: params.domain,
    ip_address: getClientIp(request),
    details: "Deleted by admin",
  });

  return NextResponse.json({
    success: true,
    data: { domain: params.domain, message: "Service deleted." },
  });
}
