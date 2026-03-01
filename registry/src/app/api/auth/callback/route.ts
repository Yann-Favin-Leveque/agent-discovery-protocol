import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import {
  exchangeCodeForTokens,
  fetchUserInfo,
  type OAuthProvider,
} from "@/lib/oauth";
import { upsertUser } from "@/lib/db";
import { createSessionToken, setSessionCookie } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const state = request.nextUrl.searchParams.get("state");
  const error = request.nextUrl.searchParams.get("error");

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  if (error) {
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(error)}`
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(`${baseUrl}/login?error=missing_params`);
  }

  // Verify CSRF state
  const cookieStore = await cookies();
  const storedState = cookieStore.get("oauth_state")?.value;
  const colonIndex = state.indexOf(":");
  const provider = state.slice(0, colonIndex);
  const stateValue = state.slice(colonIndex + 1);

  if (!storedState || storedState !== stateValue) {
    return NextResponse.redirect(`${baseUrl}/login?error=invalid_state`);
  }

  cookieStore.delete("oauth_state");

  try {
    const redirectUri = `${baseUrl}/api/auth/callback`;

    // Exchange code for access token
    const tokens = await exchangeCodeForTokens(
      provider as OAuthProvider,
      code,
      redirectUri
    );

    // Fetch user profile
    const userInfo = await fetchUserInfo(
      provider as OAuthProvider,
      tokens.access_token
    );

    // Upsert user in database
    const user = await upsertUser({
      email: userInfo.email,
      name: userInfo.name ?? undefined,
      provider,
      provider_id: userInfo.provider_id,
    });

    // Create session JWT and set cookie
    const sessionToken = await createSessionToken(user);
    await setSessionCookie(sessionToken);

    // Redirect to return_to or account dashboard
    const returnTo = cookieStore.get("oauth_return_to")?.value;
    cookieStore.delete("oauth_return_to");

    return NextResponse.redirect(returnTo || `${baseUrl}/account`);
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Authentication failed";
    return NextResponse.redirect(
      `${baseUrl}/login?error=${encodeURIComponent(message)}`
    );
  }
}
