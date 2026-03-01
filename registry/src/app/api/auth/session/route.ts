import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({
      success: true,
      data: { authenticated: false },
    });
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json({
      success: true,
      data: { authenticated: false },
    });
  }

  return NextResponse.json({
    success: true,
    data: {
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        provider: user.provider,
        payment_method_added: !!user.payment_method_added,
        created_at: user.created_at,
      },
    },
  });
}
