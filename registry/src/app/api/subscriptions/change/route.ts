import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionById, getServiceByDomain } from "@/lib/db";
import { changeSubscriptionPlan } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { subscription_id, new_plan_name, confirmation_token } = body;

    if (!subscription_id || !new_plan_name) {
      return NextResponse.json(
        { success: false, error: "subscription_id and new_plan_name are required" },
        { status: 400 }
      );
    }

    if (!confirmation_token) {
      return NextResponse.json(
        { success: false, error: "confirmation_token is required — plan changes require user confirmation" },
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

    if (subscription.status !== "active") {
      return NextResponse.json(
        { success: false, error: "Can only change plan on active subscriptions" },
        { status: 400 }
      );
    }

    // Look up new plan pricing from manifest
    const service = await getServiceByDomain(subscription.service_domain);
    let newPriceCents = body.price_cents;
    const currency = body.currency || subscription.currency;
    let interval: "month" | "year" = body.interval || subscription.interval;

    if (!newPriceCents && service) {
      try {
        const manifestRes = await fetch(service.well_known_url, {
          signal: AbortSignal.timeout(10000),
        });
        if (manifestRes.ok) {
          const manifest = await manifestRes.json();
          const plan = manifest.pricing?.plans?.find(
            (p: { name: string }) => p.name.toLowerCase() === new_plan_name.toLowerCase()
          );
          if (plan) {
            const priceMatch = plan.price?.match(/\$?(\d+(?:\.\d{2})?)/);
            const isYearly = /year|annual/i.test(plan.price ?? "");
            newPriceCents = priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : 0;
            interval = isYearly ? "year" : "month";
          }
        }
      } catch {
        // Manifest fetch failed
      }
    }

    if (!newPriceCents || newPriceCents <= 0) {
      return NextResponse.json(
        { success: false, error: `Plan "${new_plan_name}" not found or has no price` },
        { status: 400 }
      );
    }

    // Update in Stripe
    if (subscription.stripe_subscription_id) {
      await changeSubscriptionPlan(
        subscription.stripe_subscription_id,
        newPriceCents,
        currency,
        interval
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        old_plan: subscription.plan_name,
        new_plan: new_plan_name,
        new_price_cents: newPriceCents,
        message: "Plan changed successfully. Proration will be applied.",
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to change plan",
      },
      { status: 500 }
    );
  }
}
