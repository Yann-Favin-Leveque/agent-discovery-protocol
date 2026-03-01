import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    name: "submit_service",
    description:
      "Register a new service in the registry. Provide a domain to auto-discover its /.well-known/agent endpoint, or paste a manifest JSON directly.",
    endpoint: "/api/services",
    method: "POST",
    parameters: [
      {
        name: "domain",
        type: "string",
        description: "Domain to auto-discover (e.g. 'api.example.com'). The registry will fetch https://{domain}/.well-known/agent.",
        required: false,
        example: "api.mailforge.dev",
      },
      {
        name: "manifest",
        type: "object",
        description: "Full manifest JSON object, for services that don't expose the endpoint yet. Service will be registered as unverified.",
        required: false,
        example: {
          spec_version: "1.0",
          name: "My API",
          description: "Does something useful.",
          base_url: "https://api.example.com",
          auth: { type: "none" },
          capabilities: [
            { name: "do_thing", description: "Does a thing.", detail_url: "/capabilities/do_thing" },
          ],
        },
      },
    ],
    request_example: {
      method: "POST",
      url: "https://agent-dns.dev/api/services",
      headers: { "Content-Type": "application/json" },
      body: { domain: "api.mailforge.dev" },
    },
    response_example: {
      status: 201,
      body: {
        success: true,
        data: {
          domain: "api.mailforge.dev",
          name: "MailForge",
          verified: true,
          message: "Service discovered and registered successfully.",
        },
      },
    },
    auth_scopes: [],
    rate_limits: { requests_per_minute: 10 },
  });
}
