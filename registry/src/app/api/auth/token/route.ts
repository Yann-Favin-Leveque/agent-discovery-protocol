import { NextResponse } from "next/server";
import { getSession, createRegistryToken } from "@/lib/auth";
import { getUserById } from "@/lib/db";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json(
      { success: false, error: "Not authenticated" },
      { status: 401 }
    );
  }

  const user = await getUserById(session.userId);
  if (!user) {
    return NextResponse.json(
      { success: false, error: "User not found" },
      { status: 404 }
    );
  }

  const registryToken = await createRegistryToken(user);

  return NextResponse.json({
    success: true,
    data: {
      registry_token: registryToken,
      email: user.email,
      provider: user.provider,
      provider_id: user.provider_id,
      expires_in: 30 * 24 * 60 * 60,
    },
  });
}
