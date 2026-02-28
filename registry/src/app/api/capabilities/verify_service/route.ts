import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "verify_service",
    description:
      "Trigger a verification crawl of a registered service. Fetches the live /.well-known/agent endpoint, validates the manifest, and checks that at least one detail_url resolves.",
    endpoint: "/api/verify/{domain}",
    method: "POST",
    parameters: [
      {
        name: "domain",
        type: "string",
        description: "The domain of the service to verify (URL path parameter).",
        required: true,
        example: "api.mailforge.dev",
      },
    ],
    request_example: {
      method: "POST",
      url: "https://agentdns.dev/api/verify/api.mailforge.dev",
      headers: {},
    },
    response_example: {
      status: 200,
      body: {
        success: true,
        data: {
          domain: "api.mailforge.dev",
          verified: true,
          detail_url_ok: true,
          response_time_ms: 245,
          message: "Service verified successfully. Manifest updated from live endpoint.",
        },
      },
    },
    auth_scopes: [],
    rate_limits: { requests_per_minute: 5 },
  });
}
