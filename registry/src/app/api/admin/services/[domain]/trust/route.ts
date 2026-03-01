import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { updateServiceTrustLevel, logAudit } from "@/lib/db";
import type { TrustLevel } from "@/lib/db";
import { getClientIp } from "@/lib/sanitize";

const VALID_LEVELS: TrustLevel[] = ["verified", "community", "unverified"];

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

  const trustLevel = body.trust_level as TrustLevel;
  if (!trustLevel || !VALID_LEVELS.includes(trustLevel)) {
    return NextResponse.json(
      { success: false, error: `trust_level must be one of: ${VALID_LEVELS.join(", ")}` },
      { status: 400 }
    );
  }

  const service = await updateServiceTrustLevel(params.domain, trustLevel);
  if (!service) {
    return NextResponse.json(
      { success: false, error: `Service '${params.domain}' not found.` },
      { status: 404 }
    );
  }

  await logAudit({
    action: "trust_level_changed",
    domain: params.domain,
    ip_address: getClientIp(request),
    details: JSON.stringify({ new_level: trustLevel }),
  });

  return NextResponse.json({
    success: true,
    data: {
      domain: service.domain,
      name: service.name,
      trust_level: service.trust_level,
    },
  });
}
