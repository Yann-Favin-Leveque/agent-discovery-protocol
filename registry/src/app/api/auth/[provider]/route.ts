import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAuthorizationUrl, type OAuthProvider } from "@/lib/oauth";

const VALID_PROVIDERS: OAuthProvider[] = ["google", "github", "microsoft"];

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
) {
  const { provider } = await params;

  if (!VALID_PROVIDERS.includes(provider as OAuthProvider)) {
    return NextResponse.json(
      { success: false, error: "Invalid OAuth provider" },
      { status: 400 }
    );
  }

  // Generate CSRF state token
  const state = crypto.randomUUID();

  const cookieStore = await cookies();
  cookieStore.set("oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  // Preserve return_to URL
  const returnTo = request.nextUrl.searchParams.get("return_to");
  if (returnTo) {
    cookieStore.set("oauth_return_to", returnTo, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }

  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";
  const redirectUri = `${baseUrl}/api/auth/callback`;
  const url = getAuthorizationUrl(
    provider as OAuthProvider,
    `${provider}:${state}`,
    redirectUri
  );

  return NextResponse.redirect(url);
}
