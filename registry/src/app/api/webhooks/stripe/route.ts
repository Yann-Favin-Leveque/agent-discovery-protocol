import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import type Stripe from "stripe";

// Stripe webhook receiver.
//
// In the single-tenant aggregator model the only events we care about are
// related to *our own* customer billing (e.g. `invoice.paid` and
// `invoice.payment_failed` when v1.5 metered invoicing ships). The old
// Stripe Connect / per-service-subscription handlers (`account.updated`,
// `customer.subscription.deleted`, per-invoice transaction recording) are
// gone — single-tenant has no provider accounts and no per-service subs.
//
// The signature verification + event-type switch are kept as a skeleton so
// future handlers slot in cleanly.
export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json(
      { success: false, error: "Missing stripe-signature header" },
      { status: 400 }
    );
  }

  let event: Stripe.Event;
  try {
    const body = await request.text();
    event = constructWebhookEvent(body, signature);
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: `Webhook signature verification failed: ${err instanceof Error ? err.message : "unknown"}`,
      },
      { status: 400 }
    );
  }

  try {
    switch (event.type) {
      // TODO(v1.5): handle `invoice.paid` / `invoice.payment_failed` once
      // metered invoicing is wired up (see docs/pivot-unified-billing.md §4
      // "Stripe usage").
      default:
        break;
    }

    return NextResponse.json({ success: true, received: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Webhook handler failed",
      },
      { status: 500 }
    );
  }
}
