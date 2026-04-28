import { NextRequest, NextResponse } from "next/server";
import {
  getBearerSession,
  getSession,
  type SessionPayload,
} from "@/lib/auth";
import {
  getServiceByDomain,
  getUserEnablement,
  upsertUserEnablement,
} from "@/lib/db";
import { preflight, withCors } from "@/lib/cors";

// ─── Auth helper ────────────────────────────────────────────────
//
// Accept either a Bearer JWT (registry_token from the CLI / config
// page) or a cookie session (in case the page is opened against
// the deployed registry from a logged-in browser tab).

async function resolveSession(request: NextRequest): Promise<SessionPayload | null> {
  return (await getBearerSession(request)) ?? (await getSession());
}

// ─── OPTIONS ────────────────────────────────────────────────────

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

// ─── GET /api/users/me/enablement ───────────────────────────────

export async function GET(request: NextRequest) {
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

  try {
    const rows = await getUserEnablement(session.userId);
    return withCors(
      NextResponse.json({ success: true, data: rows }),
      request
    );
  } catch (err) {
    return withCors(
      NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Failed to fetch enablement",
        },
        { status: 500 }
      ),
      request
    );
  }
}

// ─── POST /api/users/me/enablement ──────────────────────────────
//
// Body: { service_id?, domain?, enabled, monthly_cap_cents?, byo_credential_blob? }
// Either service_id or domain must be provided. byo_credential_blob is
// expected as a base64 string when present.

export async function POST(request: NextRequest) {
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

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return withCors(
      NextResponse.json(
        { success: false, error: "Invalid JSON body" },
        { status: 400 }
      ),
      request
    );
  }

  const enabled = body.enabled === undefined ? true : Boolean(body.enabled);
  const monthlyCap =
    body.monthly_cap_cents == null
      ? null
      : Number(body.monthly_cap_cents);
  if (monthlyCap != null && (!Number.isFinite(monthlyCap) || monthlyCap < 0)) {
    return withCors(
      NextResponse.json(
        { success: false, error: "monthly_cap_cents must be a non-negative integer" },
        { status: 400 }
      ),
      request
    );
  }

  // Resolve service_id from either explicit service_id or domain.
  let serviceId: number | undefined;
  if (typeof body.service_id === "number") {
    serviceId = body.service_id;
  } else if (typeof body.domain === "string") {
    const svc = await getServiceByDomain(body.domain);
    if (!svc) {
      return withCors(
        NextResponse.json(
          { success: false, error: `Unknown service domain: ${body.domain}` },
          { status: 404 }
        ),
        request
      );
    }
    serviceId = svc.id;
  } else {
    return withCors(
      NextResponse.json(
        { success: false, error: "Either service_id or domain is required" },
        { status: 400 }
      ),
      request
    );
  }

  // Decode the BYO blob if present (base64 string → Buffer).
  // null clears the blob, undefined leaves it untouched.
  let blob: Buffer | null | undefined = undefined;
  if ("byo_credential_blob" in body) {
    const raw = body.byo_credential_blob;
    if (raw === null) {
      blob = null;
    } else if (typeof raw === "string") {
      try {
        blob = Buffer.from(raw, "base64");
      } catch {
        return withCors(
          NextResponse.json(
            { success: false, error: "byo_credential_blob must be base64 or null" },
            { status: 400 }
          ),
          request
        );
      }
    } else {
      return withCors(
        NextResponse.json(
          { success: false, error: "byo_credential_blob must be a base64 string or null" },
          { status: 400 }
        ),
        request
      );
    }
  }

  try {
    const row = await upsertUserEnablement({
      user_id: session.userId,
      service_id: serviceId,
      enabled,
      monthly_cap_cents: monthlyCap,
      byo_credential_blob: blob,
    });
    return withCors(
      NextResponse.json({ success: true, data: row }),
      request
    );
  } catch (err) {
    return withCors(
      NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Failed to upsert enablement",
        },
        { status: 500 }
      ),
      request
    );
  }
}
