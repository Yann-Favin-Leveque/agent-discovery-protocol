import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthorized, unauthorizedResponse } from "@/lib/admin-auth";
import { getAllOAuthClients, upsertOAuthClient, deleteOAuthClient, logAudit } from "@/lib/db";

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  try {
    const clients = await getAllOAuthClients();
    return NextResponse.json({
      success: true,
      data: clients.map(c => ({
        service_domain: c.service_domain,
        client_id: c.client_id,
        redirect_uri: c.redirect_uri,
        extra_params: c.extra_params,
        created_at: c.created_at,
        updated_at: c.updated_at,
      })),
      total: clients.length,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Internal error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  try {
    const body = await request.json();
    const { domain, client_id, client_secret, redirect_uri, extra_params } = body;

    if (!domain || !client_id || !client_secret) {
      return NextResponse.json(
        { success: false, error: "Required fields: domain, client_id, client_secret" },
        { status: 400 }
      );
    }

    const result = await upsertOAuthClient(domain, client_id, client_secret, redirect_uri, extra_params);

    await logAudit({
      action: "oauth_client_upsert",
      domain,
      details: `OAuth client registered for ${domain}`,
    });

    return NextResponse.json({
      success: true,
      data: {
        service_domain: result.service_domain,
        client_id: result.client_id,
        redirect_uri: result.redirect_uri,
        extra_params: result.extra_params,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Internal error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAdminAuthorized(request)) return unauthorizedResponse();

  try {
    const { domain } = await request.json();
    if (!domain) {
      return NextResponse.json(
        { success: false, error: "Required field: domain" },
        { status: 400 }
      );
    }

    const deleted = await deleteOAuthClient(domain);
    if (!deleted) {
      return NextResponse.json(
        { success: false, error: `No OAuth client found for '${domain}'.` },
        { status: 404 }
      );
    }

    await logAudit({
      action: "oauth_client_delete",
      domain,
      details: `OAuth client deleted for ${domain}`,
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: `Internal error: ${err instanceof Error ? err.message : "unknown"}` },
      { status: 500 }
    );
  }
}
