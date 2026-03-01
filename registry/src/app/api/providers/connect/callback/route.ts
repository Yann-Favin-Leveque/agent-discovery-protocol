import { NextRequest, NextResponse } from "next/server";
import { getConnectAccount } from "@/lib/stripe";
import { updateProviderOnboarding, getProviderAccountByStripeId } from "@/lib/db";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const accountId = searchParams.get("account_id");
  const domain = searchParams.get("domain");

  if (!accountId || !domain) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/providers/connect?error=missing_params`
    );
  }

  try {
    // Check if the account has completed onboarding
    const account = await getConnectAccount(accountId);
    const isComplete = account.charges_enabled && account.details_submitted;

    // Verify this account belongs to this domain
    const providerAccount = await getProviderAccountByStripeId(accountId);
    if (!providerAccount || providerAccount.service_domain !== domain) {
      const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
      return NextResponse.redirect(
        `${baseUrl}/providers/connect?error=account_mismatch`
      );
    }

    if (isComplete) {
      await updateProviderOnboarding(domain, true);
    }

    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    const status = isComplete ? "success" : "pending";
    return NextResponse.redirect(
      `${baseUrl}/providers/connect?status=${status}&domain=${encodeURIComponent(domain)}`
    );
  } catch (err) {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
    return NextResponse.redirect(
      `${baseUrl}/providers/connect?error=callback_failed`
    );
  }
}
