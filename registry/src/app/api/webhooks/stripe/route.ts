import { NextRequest, NextResponse } from "next/server";
import { constructWebhookEvent } from "@/lib/stripe";
import {
  updateSubscriptionStatus,
  updateSubscriptionPeriod,
  getSubscriptionByStripeId,
  getUserByStripeCustomerId,
  insertTransaction,
  updateProviderOnboarding,
  getProviderAccountByStripeId,
} from "@/lib/db";
import type Stripe from "stripe";

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
      case "invoice.payment_succeeded": {
        const invoiceRaw = event.data.object as unknown as Record<string, unknown>;
        const subscriptionId = extractStringId(invoiceRaw, "subscription");

        if (subscriptionId) {
          await updateSubscriptionStatus(subscriptionId, "active");

          // Update billing period from line items
          const lines = invoiceRaw.lines as
            | { data?: Array<{ period?: { start?: number; end?: number } }> }
            | undefined;
          const period = lines?.data?.[0]?.period;
          if (period?.start && period?.end) {
            await updateSubscriptionPeriod(
              subscriptionId,
              new Date(period.start * 1000).toISOString(),
              new Date(period.end * 1000).toISOString()
            );
          }

          // Record transaction
          const sub = await getSubscriptionByStripeId(subscriptionId);
          const customerId = extractStringId(invoiceRaw, "customer");
          const user = customerId ? await getUserByStripeCustomerId(customerId) : null;

          if (sub && user) {
            const paymentIntentId = extractStringId(invoiceRaw, "payment_intent") ?? "";
            const appFee = invoiceRaw.application_fee_amount;
            const applicationFee = typeof appFee === "number" ? appFee : 0;

            await insertTransaction({
              user_id: user.id,
              service_domain: sub.service_domain,
              stripe_payment_intent_id: paymentIntentId,
              amount_cents: (invoiceRaw.amount_paid as number) ?? 0,
              currency: (invoiceRaw.currency as string) ?? "usd",
              platform_fee_cents: applicationFee,
              status: "succeeded",
            });
          }
        }
        break;
      }

      case "invoice.payment_failed": {
        const failedInvoice = event.data.object as unknown as Record<string, unknown>;
        const failedSubId = extractStringId(failedInvoice, "subscription");
        if (failedSubId) {
          await updateSubscriptionStatus(failedSubId, "past_due");
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        await updateSubscriptionStatus(subscription.id, "canceled");
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        const isComplete = account.charges_enabled && account.details_submitted;

        const providerAccount = await getProviderAccountByStripeId(account.id);
        if (providerAccount) {
          await updateProviderOnboarding(
            providerAccount.service_domain,
            isComplete ?? false
          );
        }
        break;
      }

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

/**
 * Extract a string ID from a Stripe object field that may be a string or an
 * expanded object with an `id` property.
 */
function extractStringId(obj: unknown, field: string): string | null {
  const record = obj as Record<string, unknown>;
  const value = record[field];
  if (typeof value === "string") return value;
  if (value && typeof value === "object" && "id" in value) {
    return (value as { id: string }).id;
  }
  return null;
}
