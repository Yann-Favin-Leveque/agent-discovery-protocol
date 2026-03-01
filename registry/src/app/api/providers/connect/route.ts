import { NextRequest, NextResponse } from "next/server";
import { createConnectAccount, createConnectAccountLink } from "@/lib/stripe";
import { upsertProviderAccount, getServiceByDomain } from "@/lib/db";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { domain, email } = body;

    if (!domain || !email) {
      return NextResponse.json(
        { success: false, error: "domain and email are required" },
        { status: 400 }
      );
    }

    // Verify the service exists in the registry
    const service = await getServiceByDomain(domain);
    if (!service) {
      return NextResponse.json(
        { success: false, error: "Service not found in registry. Submit your service first." },
        { status: 404 }
      );
    }

    // Create a Stripe Connect account
    const account = await createConnectAccount(email);

    // Store the provider account mapping
    await upsertProviderAccount({
      service_domain: domain,
      stripe_connect_account_id: account.id,
    });

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Create an account link for onboarding
    const accountLink = await createConnectAccountLink(
      account.id,
      `${baseUrl}/providers/connect?refresh=true&domain=${encodeURIComponent(domain)}`,
      `${baseUrl}/api/providers/connect/callback?account_id=${account.id}&domain=${encodeURIComponent(domain)}`
    );

    return NextResponse.json({
      success: true,
      data: {
        account_id: account.id,
        onboarding_url: accountLink.url,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to create Connect account",
      },
      { status: 500 }
    );
  }
}
