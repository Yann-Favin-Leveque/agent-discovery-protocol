import { NextRequest, NextResponse } from "next/server";
import { getSubscriptionsByDomain } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const { domain } = params;

    const subscriptions = await getSubscriptionsByDomain(domain);

    return NextResponse.json({
      success: true,
      data: {
        service_domain: domain,
        active_subscribers: subscriptions.length,
        subscriptions: subscriptions.map((sub) => ({
          id: sub.id,
          user_id: sub.user_id,
          plan_name: sub.plan_name,
          price_cents: sub.price_cents,
          currency: sub.currency,
          interval: sub.interval,
          status: sub.status,
          created_at: sub.created_at,
        })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch subscribers",
      },
      { status: 500 }
    );
  }
}
