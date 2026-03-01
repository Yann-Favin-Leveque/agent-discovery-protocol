import { NextRequest, NextResponse } from "next/server";
import { getUserSubscriptions } from "@/lib/db";

export async function GET(
  _request: NextRequest,
  { params }: { params: { userId: string } }
) {
  try {
    const userId = Number(params.userId);
    if (isNaN(userId)) {
      return NextResponse.json(
        { success: false, error: "Invalid user ID" },
        { status: 400 }
      );
    }

    const subscriptions = await getUserSubscriptions(userId);

    return NextResponse.json({
      success: true,
      data: subscriptions.map((sub) => ({
        id: sub.id,
        service_domain: sub.service_domain,
        plan_name: sub.plan_name,
        price_cents: sub.price_cents,
        currency: sub.currency,
        interval: sub.interval,
        status: sub.status,
        current_period_start: sub.current_period_start,
        current_period_end: sub.current_period_end,
        created_at: sub.created_at,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : "Failed to fetch subscriptions",
      },
      { status: 500 }
    );
  }
}
