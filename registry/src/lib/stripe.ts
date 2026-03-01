import Stripe from "stripe";

// ─── Stripe client singleton ────────────────────────────────────

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (stripeClient) return stripeClient;

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not configured");
  }

  stripeClient = new Stripe(key);

  return stripeClient;
}

// ─── Platform fee ────────────────────────────────────────────────

export const PLATFORM_FEE_PERCENT = 10;

// ─── Connect (Provider onboarding) ──────────────────────────────

export async function createConnectAccount(
  email: string
): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.create({
    type: "standard",
    email,
  });
}

export async function createConnectAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<Stripe.AccountLink> {
  const stripe = getStripe();
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
}

export async function getConnectAccount(
  accountId: string
): Promise<Stripe.Account> {
  const stripe = getStripe();
  return stripe.accounts.retrieve(accountId);
}

// ─── Customers (User payment) ───────────────────────────────────

export async function createCustomer(
  email: string,
  name?: string
): Promise<Stripe.Customer> {
  const stripe = getStripe();
  return stripe.customers.create({
    email,
    name: name ?? undefined,
    metadata: { source: "agent-discovery-protocol" },
  });
}

export async function createSetupIntent(
  customerId: string
): Promise<Stripe.SetupIntent> {
  const stripe = getStripe();
  return stripe.setupIntents.create({
    customer: customerId,
    payment_method_types: ["card"],
  });
}

// ─── Subscriptions ──────────────────────────────────────────────

export async function createSubscription(opts: {
  customerId: string;
  priceAmountCents: number;
  currency: string;
  interval: "month" | "year";
  connectedAccountId: string;
  metadata?: Record<string, string>;
}): Promise<Stripe.Subscription> {
  const stripe = getStripe();

  // Create a product first
  const product = await stripe.products.create({
    name: opts.metadata?.plan_name ?? "API Subscription",
    metadata: opts.metadata ?? {},
  });

  // Create a recurring price for the product
  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: opts.priceAmountCents,
    currency: opts.currency,
    recurring: { interval: opts.interval },
  });

  // Create the subscription with the price
  const subscription = await stripe.subscriptions.create({
    customer: opts.customerId,
    items: [{ price: price.id }],
    application_fee_percent: PLATFORM_FEE_PERCENT,
    transfer_data: {
      destination: opts.connectedAccountId,
    },
    payment_behavior: "default_incomplete",
    expand: ["latest_invoice.payment_intent"],
    metadata: opts.metadata ?? {},
  });

  return subscription;
}

export async function cancelSubscription(
  subscriptionId: string
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  return stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

export async function changeSubscriptionPlan(
  subscriptionId: string,
  newPriceAmountCents: number,
  currency: string,
  interval: "month" | "year"
): Promise<Stripe.Subscription> {
  const stripe = getStripe();
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const itemId = subscription.items.data[0]?.id;
  if (!itemId) throw new Error("No subscription item found");

  // Create new product and price for the new plan
  const product = await stripe.products.create({
    name: "API Subscription",
  });

  const price = await stripe.prices.create({
    product: product.id,
    unit_amount: newPriceAmountCents,
    currency,
    recurring: { interval },
  });

  return stripe.subscriptions.update(subscriptionId, {
    items: [{ id: itemId, price: price.id }],
    proration_behavior: "create_prorations",
  });
}

// ─── Webhook verification ───────────────────────────────────────

export function constructWebhookEvent(
  payload: string | Buffer,
  signature: string
): Stripe.Event {
  const stripe = getStripe();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not configured");
  return stripe.webhooks.constructEvent(payload, signature, secret);
}
