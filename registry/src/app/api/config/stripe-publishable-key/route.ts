import { NextRequest, NextResponse } from "next/server";
import { preflight, withCors } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

// GET /api/config/stripe-publishable-key
//
// Returns the publishable key the local config page needs to mount
// Stripe Elements. Returns success:true with key=null if Stripe is not
// configured, so the page can render gracefully without it.
export async function GET(request: NextRequest) {
  const key = process.env.STRIPE_PUBLISHABLE_KEY ?? null;
  return withCors(
    NextResponse.json({ success: true, data: { publishable_key: key } }),
    request
  );
}
