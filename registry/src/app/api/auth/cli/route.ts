import { NextRequest, NextResponse } from "next/server";
import { fetchUserInfo, type OAuthProvider } from "@/lib/oauth";
import { upsertUser } from "@/lib/db";
import { createRegistryToken } from "@/lib/auth";

/**
 * POST /api/auth/cli
 *
 * Token exchange endpoint for CLI tools. Accepts a provider access token
 * (obtained via desktop OAuth flow), verifies it, upserts the user,
 * and returns a registry JWT.
 *
 * Body: { provider: "google" | "github" | "microsoft", access_token: string }
 * Returns: { success: true, data: { registry_token, email, name, provider_id } }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { provider, access_token } = body;

    if (!provider || !access_token) {
      return NextResponse.json(
        { success: false, error: "Missing provider or access_token" },
        { status: 400 }
      );
    }

    const validProviders: OAuthProvider[] = ["google", "github", "microsoft"];
    if (!validProviders.includes(provider)) {
      return NextResponse.json(
        { success: false, error: `Invalid provider: ${provider}` },
        { status: 400 }
      );
    }

    // Verify the access token by fetching user info from the provider
    const userInfo = await fetchUserInfo(provider as OAuthProvider, access_token);

    // Upsert user in database
    const user = await upsertUser({
      email: userInfo.email,
      name: userInfo.name ?? undefined,
      provider,
      provider_id: userInfo.provider_id,
    });

    // Create a long-lived registry token
    const registryToken = await createRegistryToken(user);

    return NextResponse.json({
      success: true,
      data: {
        registry_token: registryToken,
        email: user.email,
        name: user.name,
        provider_id: user.provider_id,
        expires_in: 30 * 24 * 60 * 60,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.json(
      { success: false, error: message },
      { status: 401 }
    );
  }
}
