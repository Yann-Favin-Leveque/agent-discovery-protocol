import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "discover_services",
    description:
      "Search for services by intent. Describe what you need in natural language (e.g. 'send an email', 'create an invoice') and get ranked results with matching capabilities.",
    endpoint: "/api/discover",
    method: "GET",
    parameters: [
      {
        name: "q",
        type: "string",
        description: "Natural language search query describing what you need.",
        required: true,
        example: "send email",
      },
    ],
    request_example: {
      method: "GET",
      url: "https://agent-dns.dev/api/discover?q=send+email",
      headers: {},
    },
    response_example: {
      status: 200,
      body: {
        success: true,
        query: "send email",
        result_count: 1,
        data: [
          {
            service: {
              name: "MailForge",
              domain: "api.mailforge.dev",
              description: "Send, receive, and manage emails programmatically.",
              base_url: "https://api.mailforge.dev",
              auth_type: "oauth2",
              pricing_type: "freemium",
              verified: true,
            },
            matching_capabilities: [
              {
                name: "send_email",
                description: "Send an email to one or more recipients.",
                detail_url: "https://api.mailforge.dev/capabilities/send_email",
              },
            ],
          },
        ],
      },
    },
    auth_scopes: [],
    rate_limits: { requests_per_minute: 60 },
  });
}
