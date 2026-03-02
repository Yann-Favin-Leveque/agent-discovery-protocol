import { NextRequest, NextResponse } from "next/server";
import { getOAuthClient, getServiceByDomain } from "@/lib/db";

export async function GET(
  _request: NextRequest,
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

    // Return client_id and extra_params — NEVER return client_secret
    return NextResponse.json({
      success: true,
      data: {
        client_id: oauthClient.client_id,
        redirect_uri: oauthClient.redirect_uri,
        extra_params: oauthClient.extra_params,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Internal error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
