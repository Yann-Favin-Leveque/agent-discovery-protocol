import { NextRequest, NextResponse } from "next/server";
import {
  getUserById,
  getProviderAccount,
  getServiceByDomain,
  insertSubscription,
  insertTransaction,
  updateUserStripeCustomer,
} from "@/lib/db";
import {
  createSubscription,
  createCustomer,
  PLATFORM_FEE_PERCENT,
} from "@/lib/stripe";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, service_domain, plan_name } = body;

    if (!user_id || !service_domain || !plan_name) {
      return NextResponse.json(
        { success: false, error: "user_id, service_domain, and plan_name are required" },
        { status: 400 }
      );
    }

    // 1. Look up the user
    const user = await getUserById(Number(user_id));
    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
      );
    }

    if (!user.payment_method_added) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      return NextResponse.json(
        {
          success: false,
          error: "No payment method on file",
          payment_setup_url: `${baseUrl}/pay/setup?email=${encodeURIComponent(user.email)}`,
        },
        { status: 402 }
      );
    }

    // 2. Look up the service
    const service = await getServiceByDomain(service_domain);
    if (!service) {
      return NextResponse.json(
        { success: false, error: "Service not found" },
        { status: 404 }
      );
    }

    // 3. Look up the provider's Stripe Connect account
    const providerAccount = await getProviderAccount(service_domain);
    if (!providerAccount || !providerAccount.onboarding_complete) {
      return NextResponse.json(
        { success: false, error: "This service has not set up payments yet" },
        { status: 400 }
      );
    }

    // 4. Parse pricing from service manifest
    let pricingInfo: { price_cents: number; currency: string; interval: "month" | "year" } | null = null;

    try {
      // Try to fetch manifest pricing
      const manifestRes = await fetch(service.well_known_url, {
        signal: AbortSignal.timeout(10000),
      });
      if (manifestRes.ok) {
        const manifest = await manifestRes.json();
        if (manifest.pricing?.plans) {
          const plan = manifest.pricing.plans.find(
            (p: { name: string }) => p.name.toLowerCase() === plan_name.toLowerCase()
          );
          if (plan) {
            // Parse price string (e.g., "$29/mo", "$99/year")
            const priceMatch = plan.price?.match(/\$?(\d+(?:\.\d{2})?)/);
            const isYearly = /year|annual/i.test(plan.price ?? "");
            pricingInfo = {
              price_cents: priceMatch ? Math.round(parseFloat(priceMatch[1]) * 100) : 0,
              currency: "usd",
              interval: isYearly ? "year" : "month",
            };
          }
        }
      }
    } catch {
      // If manifest fetch fails, use body params as fallback
    }

    // Allow explicit price override from request body
    if (body.price_cents) {
      pricingInfo = {
        price_cents: Number(body.price_cents),
        currency: body.currency || "usd",
        interval: body.interval || "month",
      };
    }

    if (!pricingInfo || pricingInfo.price_cents <= 0) {
      return NextResponse.json(
        { success: false, error: `Plan "${plan_name}" not found or has no price` },
        { status: 400 }
      );
    }

    // 5. Ensure user has a Stripe customer
    let customerId = user.stripe_customer_id;
    if (!customerId) {
      const customer = await createCustomer(user.email, user.name ?? undefined);
      await updateUserStripeCustomer(user.id, customer.id);
      customerId = customer.id;
    }

    // 6. Create the Stripe subscription
    const stripeSubscription = await createSubscription({
      customerId,
      priceAmountCents: pricingInfo.price_cents,
      currency: pricingInfo.currency,
      interval: pricingInfo.interval,
      connectedAccountId: providerAccount.stripe_connect_account_id,
      metadata: {
        plan_name,
        service_domain,
        user_id: String(user.id),
      },
    });

    // 7. Store subscription locally
    const subRecord = stripeSubscription as unknown as Record<string, unknown>;
    const periodStart = typeof subRecord.current_period_start === "number"
      ? new Date(subRecord.current_period_start * 1000).toISOString()
      : undefined;
    const periodEnd = typeof subRecord.current_period_end === "number"
      ? new Date(subRecord.current_period_end * 1000).toISOString()
      : undefined;

    const subscription = await insertSubscription({
      user_id: user.id,
      service_domain,
      stripe_subscription_id: stripeSubscription.id,
      plan_name,
      price_cents: pricingInfo.price_cents,
      currency: pricingInfo.currency,
      interval: pricingInfo.interval,
      status: "active",
      current_period_start: periodStart,
      current_period_end: periodEnd,
    });

    // 8. Record the transaction
    const platformFee = Math.round(pricingInfo.price_cents * PLATFORM_FEE_PERCENT / 100);
    const invoice = subRecord.latest_invoice;
    let paymentIntentId = "";
    if (typeof invoice === "object" && invoice !== null) {
      const inv = invoice as Record<string, unknown>;
      const pi = inv.payment_intent;
      if (typeof pi === "string") paymentIntentId = pi;
      else if (pi && typeof pi === "object" && "id" in pi) paymentIntentId = (pi as { id: string }).id;
    }

    await insertTransaction({
      user_id: user.id,
      service_domain,
      stripe_payment_intent_id: paymentIntentId,
      amount_cents: pricingInfo.price_cents,
      currency: pricingInfo.currency,
      platform_fee_cents: platformFee,
      status: "succeeded",
    });

    return NextResponse.json({
      success: true,
      data: {
        subscription_id: subscription.id,
        stripe_subscription_id: stripeSubscription.id,
        plan_name,
        price_cents: pricingInfo.price_cents,
        currency: pricingInfo.currency,
        interval: pricingInfo.interval,
        status: subscription.status,
        current_period_end: subscription.current_period_end,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create subscription",
      },
      { status: 500 }
    );
  }
}
