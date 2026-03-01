import { NextRequest, NextResponse } from "next/server";

export function isAdminAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get("authorization");
  const adminSecret = process.env.ADMIN_SECRET;
  if (!adminSecret) return false;
  return authHeader === `Bearer ${adminSecret}`;
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { success: false, error: "Unauthorized. Provide a valid ADMIN_SECRET in the Authorization header." },
    { status: 401 }
  );
}
