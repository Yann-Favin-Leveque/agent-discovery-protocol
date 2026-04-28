import { NextRequest, NextResponse } from "next/server";
import { getBearerSession, getSession, type SessionPayload } from "@/lib/auth";
import { getUserById } from "@/lib/db";
import { getStripe } from "@/lib/stripe";
import { preflight, withCors } from "@/lib/cors";

async function resolveSession(request: NextRequest): Promise<SessionPayload | null> {
  return (await getBearerSession(request)) ?? (await getSession());
}

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

// POST /api/users/me/billing-portal
//
// Returns a Stripe Customer Portal session URL for the signed-in user.
// The local config page links to this so users can manage invoices,
// payment methods, and download receipts without us building a UI.
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

  try {
    const user = await getUserById(session.userId);
    if (!user || !user.stripe_customer_id) {
      return withCors(
        NextResponse.json(
          {
            success: false,
            error: "No payment method on file. Add a card first.",
          },
          { status: 400 }
        ),
        request
      );
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "https://agent-dns.dev";
    const stripe = getStripe();
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${baseUrl}/account`,
    });

    return withCors(
      NextResponse.json({ success: true, data: { url: portal.url } }),
      request
    );
  } catch (err) {
    return withCors(
      NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Failed to create portal session",
        },
        { status: 500 }
      ),
      request
    );
  }
}
