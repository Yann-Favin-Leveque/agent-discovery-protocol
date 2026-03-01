import { NextRequest, NextResponse } from "next/server";
import { createCustomer, createSetupIntent } from "@/lib/stripe";
import {
  getUserById,
  getUserByEmail,
  updateUserStripeCustomer,
  updateUserPaymentMethod,
} from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id, email } = body;

    if (!user_id && !email) {
      return NextResponse.json(
        { success: false, error: "user_id or email is required" },
        { status: 400 }
      );
    }

    // Find the user
    let user = user_id
      ? await getUserById(Number(user_id))
      : await getUserByEmail(email);

    if (!user) {
      return NextResponse.json(
        { success: false, error: "User not found" },
        { status: 404 }
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

    return NextResponse.json({
      success: true,
      data: {
        client_secret: setupIntent.client_secret,
        customer_id: user.stripe_customer_id,
        setup_intent_id: setupIntent.id,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create setup intent",
      },
      { status: 500 }
    );
  }
}

// Called after successful card setup to mark payment method as added
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { user_id } = body;

    if (!user_id) {
      return NextResponse.json(
        { success: false, error: "user_id is required" },
        { status: 400 }
      );
    }

    await updateUserPaymentMethod(Number(user_id), true);

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to update payment method",
      },
      { status: 500 }
    );
  }
}
