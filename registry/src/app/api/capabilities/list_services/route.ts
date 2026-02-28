import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "list_services",
    description:
      "List all services registered in the directory. Supports pagination, category filtering, and sorting.",
    endpoint: "/api/services",
    method: "GET",
    parameters: [
      {
        name: "category",
        type: "string",
        description: "Filter by category slug (e.g. 'email', 'payments', 'developer-tools').",
        required: false,
        example: "email",
      },
      {
        name: "search",
        type: "string",
        description: "Search term to filter services by name or description.",
        required: false,
        example: "mail",
      },
      {
        name: "sort",
        type: "string",
        description: "Sort order: 'newest', 'name', or 'capabilities'.",
        required: false,
        example: "newest",
      },
      {
        name: "limit",
        type: "number",
        description: "Max results to return (1-100, default 50).",
        required: false,
        example: 20,
      },
      {
        name: "offset",
        type: "number",
        description: "Pagination offset (default 0).",
        required: false,
        example: 0,
      },
    ],
    request_example: {
      method: "GET",
      url: "https://agentdns.dev/api/services?category=email&sort=newest&limit=10",
      headers: {},
    },
    response_example: {
      status: 200,
      body: {
        success: true,
        data: [
          {
            name: "MailForge",
            domain: "api.mailforge.dev",
            description: "Send, receive, and manage emails.",
            auth_type: "oauth2",
            verified: true,
            capability_count: 3,
          },
        ],
        pagination: { total: 1, limit: 10, offset: 0 },
      },
    },
    auth_scopes: [],
    rate_limits: { requests_per_minute: 60 },
  });
}
