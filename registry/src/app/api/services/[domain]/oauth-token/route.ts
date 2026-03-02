import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, getServiceByDomain } from "@/lib/db";

export async function POST(
  request: NextRequest,
  { params }: { params: { domain: string } }
) {
  try {
    const service = await getServiceByDomain(params.domain);
    if (!service) {
      return NextResponse.json(
        { success: false, error: `Service '${params.domain}' not found.` },
        { status: 404 }
      );
    }

    const oauthClient = await getOAuthClient(params.domain);
    if (!oauthClient) {
      return NextResponse.json(
        { success: false, error: `No OAuth client registered for '${params.domain}'.` },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { grant_type, code, redirect_uri, refresh_token } = body;

    // Get token_url from the service's auth_details
    const authDetails = JSON.parse(service.auth_details);
    const tokenUrl = authDetails.token_url;
    if (!tokenUrl) {
      return NextResponse.json(
        { success: false, error: `No token_url configured for '${params.domain}'.` },
        { status: 400 }
      );
    }

    // Build the token exchange request — inject client_secret server-side
    const tokenParams: Record<string, string> = {
      client_id: oauthClient.client_id,
      client_secret: oauthClient.client_secret,
    };

    if (grant_type === "refresh_token" && refresh_token) {
      tokenParams.grant_type = "refresh_token";
      tokenParams.refresh_token = refresh_token;
    } else if (code) {
      tokenParams.grant_type = "authorization_code";
      tokenParams.code = code;
      tokenParams.redirect_uri = redirect_uri || oauthClient.redirect_uri;
    } else {
      return NextResponse.json(
        { success: false, error: "Must provide 'code' or 'grant_type: refresh_token' with 'refresh_token'." },
        { status: 400 }
      );
    }

    // Forward to the service's token endpoint
    const tokenRes = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: new URLSearchParams(tokenParams).toString(),
      signal: AbortSignal.timeout(15000),
    });

    const contentType = tokenRes.headers.get("content-type") ?? "";
    let tokenData: Record<string, unknown>;

    if (contentType.includes("application/json")) {
      tokenData = await tokenRes.json();
    } else {
      // Some providers (GitHub) return form-encoded
      const text = await tokenRes.text();
      tokenData = Object.fromEntries(new URLSearchParams(text));
    }

    if (!tokenRes.ok) {
      return NextResponse.json(
        { success: false, error: `Token exchange failed: HTTP ${tokenRes.status}`, data: tokenData },
        { status: tokenRes.status }
      );
    }

    if (tokenData.error) {
      return NextResponse.json(
        { success: false, error: `Token error: ${tokenData.error_description || tokenData.error}` },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
        expires_in: tokenData.expires_in,
        scope: tokenData.scope,
        token_type: tokenData.token_type,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Internal error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
