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
