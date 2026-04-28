import { NextResponse } from "next/server";

// ─── CORS for the local `agent-gateway config` page ──────────────
//
// The local config server runs on http://localhost:9876..9885 and
// makes cross-origin requests to a handful of registry endpoints
// (user enablement, payment method setup, billing portal, Stripe
// publishable key). We allow that range and only that range — these
// helpers are NOT applied globally, only on the routes that need it.

const ALLOWED_HOSTS = new Set<string>([
  ...Array.from({ length: 10 }, (_, i) => `http://localhost:${9876 + i}`),
  ...Array.from({ length: 10 }, (_, i) => `http://127.0.0.1:${9876 + i}`),
]);

function isAllowedOrigin(origin: string | null | undefined): boolean {
  if (!origin) return false;
  return ALLOWED_HOSTS.has(origin);
}

/**
 * Build CORS headers for a request whose Origin is in our allowlist.
 * Returns an empty object when the origin is not allowed (no CORS leakage).
 */
export function corsHeaders(origin: string | null | undefined): Record<string, string> {
  if (!isAllowedOrigin(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin!,
    "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Allow-Credentials": "true",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
}

/**
 * Standard preflight handler for an OPTIONS request from the local page.
 * Use as: `export async function OPTIONS(req: NextRequest) { return preflight(req); }`
 */
export function preflight(request: Request): NextResponse {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  if (Object.keys(headers).length === 0) {
    // Origin not allowed — respond 403 with no CORS headers.
    return new NextResponse(null, { status: 403 });
  }
  return new NextResponse(null, { status: 204, headers });
}

/**
 * Wrap a NextResponse with CORS headers when the request's origin is
 * in our allowlist. Pass-through otherwise.
 */
export function withCors(response: NextResponse, request: Request): NextResponse {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);
  for (const [k, v] of Object.entries(headers)) {
    response.headers.set(k, v);
  }
  return response;
}
