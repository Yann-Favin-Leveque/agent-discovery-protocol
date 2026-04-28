import { NextRequest, NextResponse } from "next/server";
import {
  getBearerSession,
  getSession,
  type SessionPayload,
} from "@/lib/auth";
import { disableUserService } from "@/lib/db";
import { preflight, withCors } from "@/lib/cors";

async function resolveSession(request: NextRequest): Promise<SessionPayload | null> {
  return (await getBearerSession(request)) ?? (await getSession());
}

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

// DELETE /api/users/me/enablement/:domain — soft-delete (sets enabled=false).
// We keep the row so monthly_cap_cents and byo_credential_blob persist
// for re-enabling later without re-entering data.
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ domain: string }> }
) {
  const session = await resolveSession(request);
  if (!session) {
    return withCors(
      NextResponse.json(
        { success: false, error: "Not authenticated" },
        { status: 401 }
      ),
      request
    );
  }

  const { domain } = await params;
  if (!domain) {
    return withCors(
      NextResponse.json(
        { success: false, error: "Missing domain" },
        { status: 400 }
      ),
      request
    );
  }

  try {
    const ok = await disableUserService(session.userId, domain);
    if (!ok) {
      return withCors(
        NextResponse.json(
          { success: false, error: `No enablement found for ${domain}` },
          { status: 404 }
        ),
        request
      );
    }
    return withCors(
      NextResponse.json({ success: true, data: { domain, enabled: false } }),
      request
    );
  } catch (err) {
    return withCors(
      NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Failed to disable service",
        },
        { status: 500 }
      ),
      request
    );
  }
}
