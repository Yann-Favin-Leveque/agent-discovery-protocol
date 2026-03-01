import { NextResponse } from "next/server";

const REGISTRY_MANIFEST = {
  spec_version: "1.0",
  name: "AgentDNS Registry",
  description:
    "The searchable registry for the Agent Discovery Protocol. Find any API by intent, submit new services, and verify endpoints. This is the DNS for AI agents — query it to discover services instead of installing plugins.",
  base_url: "https://agent-dns.dev",
  auth: {
    type: "none" as const,
  },
  capabilities: [
    {
      name: "discover_services",
      description:
        "Search for services by intent. Describe what you need in natural language (e.g. 'send an email', 'create an invoice') and get ranked results with matching capabilities.",
      detail_url: "/api/capabilities/discover_services",
    },
    {
      name: "list_services",
      description:
        "List all services registered in the directory. Supports pagination, category filtering, and sorting by newest, name, or capability count.",
      detail_url: "/api/capabilities/list_services",
    },
    {
      name: "submit_service",
      description:
        "Register a new service in the registry. Provide a domain to auto-discover its /.well-known/agent endpoint, or paste a manifest JSON directly.",
      detail_url: "/api/capabilities/submit_service",
    },
    {
      name: "verify_service",
      description:
        "Trigger a verification crawl of a registered service. Fetches the live /.well-known/agent endpoint, validates the manifest, and checks that at least one detail_url resolves.",
      detail_url: "/api/capabilities/verify_service",
    },
  ],
};

export async function GET() {
  return NextResponse.json(REGISTRY_MANIFEST, {
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=3600",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
