import { NextRequest, NextResponse } from "next/server";
import { createCustomer, createSetupIntent } from "@/lib/stripe";
import {
  getUserById,
  getUserByEmail,
  updateUserStripeCustomer,
  updateUserPaymentMethod,
} from "@/lib/db";
import { getBearerSession, getSession } from "@/lib/auth";
import { preflight, withCors } from "@/lib/cors";

export async function OPTIONS(request: NextRequest) {
  return preflight(request);
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    let { user_id } = body as { user_id?: number | string; email?: string };
    const { email } = body as { user_id?: number | string; email?: string };

    // If no explicit user_id/email, fall back to the bearer / cookie session.
    if (!user_id && !email) {
      const session =
        (await getBearerSession(request)) ?? (await getSession());
      if (session) {
        user_id = session.userId;
      }
    }

    if (!user_id && !email) {
      return withCors(
        NextResponse.json(
          { success: false, error: "user_id or email is required" },
          { status: 400 }
        ),
        request
      );
    }

    // Find the user
    let user = user_id
      ? await getUserById(Number(user_id))
      : await getUserByEmail(email!);

    if (!user) {
      return withCors(
        NextResponse.json(
          { success: false, error: "User not found" },
          { status: 404 }
        ),
        request
      );
    }

    // Create Stripe customer if not exists
    if (!user.stripe_customer_id) {
      const customer = await createCustomer(user.email, user.name ?? undefined);
      await updateUserStripeCustomer(user.id, customer.id);
      user = (await getUserById(user.id))!;
    }

    // Create a SetupIntent for saving a payment method
    const setupIntent = await createSetupIntent(user.stripe_customer_id!);

    return withCors(
      NextResponse.json({
        success: true,
        data: {
          client_secret: setupIntent.client_secret,
          customer_id: user.stripe_customer_id,
          setup_intent_id: setupIntent.id,
        },
      }),
      request
    );
  } catch (err) {
    return withCors(
      NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Failed to create setup intent",
        },
        { status: 500 }
      ),
      request
    );
  }
}

// Called after successful card setup to mark payment method as added
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({} as Record<string, unknown>));
    let { user_id } = body as { user_id?: number | string };

    if (!user_id) {
      const session =
        (await getBearerSession(request)) ?? (await getSession());
      if (session) {
        user_id = session.userId;
      }
    }

    if (!user_id) {
      return withCors(
        NextResponse.json(
          { success: false, error: "user_id is required" },
          { status: 400 }
        ),
        request
      );
    }

    await updateUserPaymentMethod(Number(user_id), true);

    return withCors(NextResponse.json({ success: true }), request);
  } catch (err) {
    return withCors(
      NextResponse.json(
        {
          success: false,
          error: err instanceof Error ? err.message : "Failed to update payment method",
        },
        { status: 500 }
      ),
      request
    );
  }
}
