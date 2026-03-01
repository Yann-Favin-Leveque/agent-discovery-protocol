import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionById, updateSubscriptionStatus } from "@/lib/db";
import { cancelSubscription } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription_id, confirmation_token } = body;

    if (!subscription_id) {
      return NextResponse.json(
        { success: false, error: "subscription_id is required" },
        { status: 400 }
      );
    }

    // In production, validate confirmation_token (biometric/PIN)
    if (!confirmation_token) {
      return NextResponse.json(
        { success: false, error: "confirmation_token is required — cancellation requires user confirmation" },
        { status: 400 }
      );
    }

    const subscription = await getSubscriptionById(Number(subscription_id));
    if (!subscription) {
      return NextResponse.json(
        { success: false, error: "Subscription not found" },
        { status: 404 }
      );
    }

    if (subscription.status === "canceled") {
      return NextResponse.json(
        { success: false, error: "Subscription is already canceled" },
        { status: 400 }
      );
    }

    // Cancel at period end in Stripe
    if (subscription.stripe_subscription_id) {
      await cancelSubscription(subscription.stripe_subscription_id);
    }

    // Mark as canceled locally
    await updateSubscriptionStatus(
      subscription.stripe_subscription_id!,
      "canceled"
    );

    return NextResponse.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        status: "canceled",
        ends_at: subscription.current_period_end,
        message: "Subscription canceled. Access continues until end of billing period.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to cancel subscription",
      },
      { status: 500 }
    );
  }
}
