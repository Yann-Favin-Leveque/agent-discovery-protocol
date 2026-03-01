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
  const hasJwtSecret = !!process.env.JWT_SECRET;
  console.log(`[cli-auth] START — JWT_SECRET present: ${hasJwtSecret}, env keys: ${Object.keys(process.env).filter(k => k.includes("JWT") || k.includes("TURSO") || k.includes("OAUTH")).join(", ")}`);

  try {
    const body = await request.json();
    const { provider, access_token } = body;
    console.log(`[cli-auth] provider=${provider}, has_token=${!!access_token}`);

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
    console.log(`[cli-auth] Fetching user info from ${provider}...`);
    const userInfo = await fetchUserInfo(provider as OAuthProvider, access_token);
    console.log(`[cli-auth] Got user info: ${userInfo.email}`);

    // Upsert user in database
    console.log(`[cli-auth] Upserting user...`);
    const user = await upsertUser({
      email: userInfo.email,
      name: userInfo.name ?? undefined,
      provider,
      provider_id: userInfo.provider_id,
    });
    console.log(`[cli-auth] User upserted: id=${user.id}`);

    // Create a long-lived registry token
    console.log(`[cli-auth] Creating registry token...`);
    const registryToken = await createRegistryToken(user);
    console.log(`[cli-auth] Token created successfully`);

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
    const stack = err instanceof Error ? err.stack : "";
    console.error(`[cli-auth] ERROR: ${message}`);
    console.error(`[cli-auth] STACK: ${stack}`);
    return NextResponse.json(
      { success: false, error: message },
      { status: 401 }
    );
  }
}
