#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { discoverByQuery, fetchManifest, fetchCapabilityDetail, clearCache } from "./discovery.js";
import { authenticate, storeApiKey } from "./auth.js";
import { callCapability } from "./caller.js";
import {
  getToken,
  getConnection,
  getAllConnections,
  getAllTokens,
  isInitialized,
  getIdentity,
  setRegistryUrl,
  syncTokensToCloud,
  syncTokensFromCloud,
  clearAllCaches,
} from "./config.js";

// ─── CLI argument parsing ────────────────────────────────────────

function parseArgs(): void {
  const args = process.argv.slice(2);
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--registry" && args[i + 1]) {
      setRegistryUrl(args[i + 1]);
      i++;
    }
  }
}

parseArgs();

// ─── MCP Server ──────────────────────────────────────────────────

const server = new McpServer(
  {
    name: "agent-gateway",
    version: "0.1.0",
  },
  {
    capabilities: {
      logging: {},
    },
  }
);

// ─── Tool 1: discover ───────────────────────────────────────────────

server.registerTool(
  "discover",
  {
    description: "Search for services by intent, explore a specific domain, or drill into a capability. " +
      "Use `query` to search the registry (e.g. 'send email'), `domain` to fetch a specific service's manifest, " +
      "or `domain` + `capability` to get full details on how to call a specific capability.",
    inputSchema: {
      query: z.string().optional().describe("Natural language search (e.g. 'send email', 'create invoice')"),
      domain: z.string().optional().describe("Specific domain to explore (e.g. 'api.mailforge.dev')"),
      capability: z.string().optional().describe("Capability name to drill into (requires domain)"),
    },
  },
  async ({ query, domain, capability }) => {
    try {
      // Mode 1: Search registry by query
      if (query && !domain) {
        const results = await discoverByQuery(query);
        const connections = getAllConnections();
        const connectedDomains = new Set(connections.map((c) => c.domain));

        const text = results.data
          .map((r) => {
            const connected = connectedDomains.has(r.service.domain);
            const status = connected ? "[CONNECTED]" : "[NOT CONNECTED]";
            const trustLevel = r.service.trust_level ?? (r.service.verified ? "verified" : "unverified");
            const trustBadge = trustLevel === "verified" ? "[VERIFIED]" :
                               trustLevel === "community" ? "[COMMUNITY]" : "[UNVERIFIED]";
            const caps = r.matching_capabilities.length > 0
              ? r.matching_capabilities.map((c) => `    - ${c.name}: ${c.description}`).join("\n")
              : r.all_capabilities.map((c) => `    - ${c.name}: ${c.description}`).join("\n");

            return [
              `${r.service.name} (${r.service.domain}) ${trustBadge} ${status}`,
              `  ${r.service.description}`,
              `  Auth: ${r.service.auth_type} | Pricing: ${r.service.pricing_type} | Trust: ${trustLevel}`,
              `  Capabilities:`,
              caps,
            ].join("\n");
          })
          .join("\n\n");

        return {
          content: [
            {
              type: "text" as const,
              text: results.result_count === 0
                ? `No services found for "${query}". Try different keywords.`
                : `Found ${results.result_count} service(s) for "${query}":\n\n${text}`,
            },
          ],
        };
      }

      // Mode 2: Fetch specific domain's manifest
      if (domain && !capability) {
        const manifest = await fetchManifest(domain);
        const token = getToken(domain);
        const connected = token && token.access_token ? "[CONNECTED]" : "[NOT CONNECTED]";

        const caps = manifest.capabilities
          .map((c) => `  - ${c.name}: ${c.description}`)
          .join("\n");

        const text = [
          `${manifest.name} (${domain}) ${connected}`,
          `${manifest.description}`,
          ``,
          `Base URL: ${manifest.base_url}`,
          `Auth: ${manifest.auth.type}`,
          manifest.pricing ? `Pricing: ${manifest.pricing.type}` : null,
          `Spec version: ${manifest.spec_version}`,
          ``,
          `Capabilities:`,
          caps,
          ``,
          `To use a capability, call the 'call' tool with domain="${domain}" and the capability name.`,
          `To see full details on a capability, call 'discover' with domain="${domain}" and capability="<name>".`,
        ]
          .filter((l) => l !== null)
          .join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      // Mode 3: Drill into a specific capability
      if (domain && capability) {
        const detail = await fetchCapabilityDetail(domain, capability);
        const manifest = await fetchManifest(domain);
        const fullUrl = detail.endpoint.startsWith("http")
          ? detail.endpoint
          : `${manifest.base_url}${detail.endpoint}`;

        const params = detail.parameters
          .map(
            (p) =>
              `  - ${p.name} (${p.type}${p.required ? ", required" : ", optional"}): ${p.description}${p.example !== undefined ? ` Example: ${JSON.stringify(p.example)}` : ""}`
          )
          .join("\n");

        const text = [
          `${detail.name} — ${manifest.name}`,
          `${detail.description}`,
          ``,
          `Endpoint: ${detail.method} ${fullUrl}`,
          detail.auth_scopes?.length ? `Scopes needed: ${detail.auth_scopes.join(", ")}` : null,
          detail.rate_limits ? `Rate limits: ${detail.rate_limits.requests_per_minute ?? "?"}/min, ${detail.rate_limits.daily_limit ?? "?"}/day` : null,
          ``,
          `Parameters:`,
          params,
          ``,
          `Example request:`,
          JSON.stringify(detail.request_example, null, 2),
          ``,
          `Example response:`,
          JSON.stringify(detail.response_example, null, 2),
          ``,
          `To call this capability, use the 'call' tool with:`,
          `  domain: "${domain}"`,
          `  capability: "${capability}"`,
          `  params: { ... }`,
        ]
          .filter((l) => l !== null)
          .join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      return {
        content: [
          {
            type: "text" as const,
            text: "Please provide either a 'query' to search services, a 'domain' to explore a specific service, or both 'domain' and 'capability' to see capability details.",
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Discovery failed: ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool 2: call ───────────────────────────────────────────────────

server.registerTool(
  "call",
  {
    description: "Call a capability on a service. The gateway handles auth, request construction, and execution. " +
      "First use 'discover' to find the service and capability, then call it here.",
    inputSchema: {
      domain: z.string().describe("Service domain (e.g. 'api.mailforge.dev')"),
      capability: z.string().describe("Capability name (e.g. 'send_email')"),
      params: z.record(z.string(), z.unknown()).optional().describe("Parameters for the capability (key-value object)"),
      api_key: z.string().optional().describe("API key if the service requires one and you haven't connected yet"),
    },
  },
  async ({ domain, capability, params, api_key }) => {
    try {
      const result = await callCapability(domain, capability, params ?? {}, api_key);

      if (!result.success) {
        const text = result.auth_required
          ? `Authentication required for ${domain}.\n\n${result.error}\n\nUse the 'auth' tool to connect first.`
          : `Call failed: ${result.error}${result.data ? `\n\nResponse:\n${JSON.stringify(result.data, null, 2)}` : ""}`;

        return {
          content: [{ type: "text" as const, text }],
          isError: true,
        };
      }

      // Sync new connection to cloud (fire and forget)
      syncTokensToCloud().catch(() => { /* silent */ });

      return {
        content: [
          {
            type: "text" as const,
            text: `${capability} on ${domain} — HTTP ${result.status}\n\n${JSON.stringify(result.data, null, 2)}`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Call failed: ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool 3: auth ───────────────────────────────────────────────────

server.registerTool(
  "auth",
  {
    description: "Connect to a service. For OAuth2 services, opens a browser for authorization. " +
      "For API key services, provide the key. For public APIs, auto-connects. " +
      "Tokens are cloud-synced to your registry account.",
    inputSchema: {
      domain: z.string().describe("Service domain to connect to"),
      api_key: z.string().optional().describe("API key (for api_key auth type services)"),
    },
  },
  async ({ domain, api_key }) => {
    try {
      let result;
      if (api_key) {
        result = await storeApiKey(domain, api_key);
      } else {
        result = await authenticate(domain);
      }

      // Sync to cloud on successful auth
      if (result.success) {
        syncTokensToCloud().catch(() => { /* silent */ });
      }

      return {
        content: [{ type: "text" as const, text: result.message }],
        isError: !result.success,
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Auth failed: ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool 4: subscribe ──────────────────────────────────────────────

server.registerTool(
  "subscribe",
  {
    description: "Subscribe to a paid service plan. Shows plan details and asks for user confirmation. " +
      "The agent can NEVER auto-approve payments — always requires human confirmation.",
    inputSchema: {
      domain: z.string().describe("Service domain"),
      plan: z.string().describe("Plan name to subscribe to (from the service's pricing info)"),
    },
  },
  async ({ domain, plan }) => {
    try {
      const manifest = await fetchManifest(domain);

      if (!manifest.pricing || manifest.pricing.type === "free") {
        return {
          content: [
            {
              type: "text" as const,
              text: `${manifest.name} is free — no subscription needed. Just use the 'call' tool.`,
            },
          ],
        };
      }

      const matchedPlan = manifest.pricing.plans?.find(
        (p) => p.name.toLowerCase() === plan.toLowerCase()
      );

      if (!matchedPlan) {
        const available = manifest.pricing.plans
          ?.map((p) => `  - ${p.name}: ${p.price} (${p.limits})`)
          .join("\n");
        return {
          content: [
            {
              type: "text" as const,
              text: `Plan "${plan}" not found for ${manifest.name}.\n\nAvailable plans:\n${available ?? "No plans listed."}${manifest.pricing.plans_url ? `\n\nSee details: ${manifest.pricing.plans_url}` : ""}`,
            },
          ],
          isError: true,
        };
      }

      const identity = getIdentity();
      const paymentStatus = identity
        ? "Your payment method on file will be used."
        : "Set up a payment method first with `agent-gateway init`.";

      const text = [
        `Subscription details for ${manifest.name}:`,
        ``,
        `  Plan: ${matchedPlan.name}`,
        `  Price: ${matchedPlan.price}`,
        `  Limits: ${matchedPlan.limits}`,
        manifest.pricing.plans_url ? `  Details: ${manifest.pricing.plans_url}` : null,
        ``,
        `  Payment: ${paymentStatus}`,
        ``,
        `  IMPORTANT: Payment requires user confirmation.`,
        `  The user will receive a confirmation prompt (push notification or browser)`,
        `  to approve this subscription with biometric/PIN confirmation.`,
        ``,
        `  To proceed, the user must confirm via the AgentDNS app or registry website.`,
      ]
        .filter((l) => l !== null)
        .join("\n");

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Subscribe failed: ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool 5: manage_subscriptions ───────────────────────────────────

server.registerTool(
  "manage_subscriptions",
  {
    description: "List, cancel, upgrade, or downgrade subscriptions. Without arguments, lists all active subscriptions.",
    inputSchema: {
      domain: z.string().optional().describe("Service domain to manage"),
      action: z
        .enum(["cancel", "upgrade", "downgrade"])
        .optional()
        .describe("Action to perform"),
      plan: z.string().optional().describe("Target plan for upgrade/downgrade"),
    },
  },
  async ({ domain, action, plan }) => {
    try {
      // List all subscriptions
      if (!domain) {
        const connections = getAllConnections();
        const withSubs = connections.filter((c) => c.subscription);

        if (withSubs.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No active subscriptions.\n\nUse 'discover' to find services, then 'subscribe' to sign up for a plan.",
              },
            ],
          };
        }

        const list = withSubs
          .map(
            (c) =>
              `  ${c.service_name} (${c.domain}) — ${c.subscription!.plan} [${c.subscription!.status}]`
          )
          .join("\n");

        return {
          content: [
            {
              type: "text" as const,
              text: `Active subscriptions:\n\n${list}`,
            },
          ],
        };
      }

      // Manage specific subscription
      if (!action) {
        const conn = getConnection(domain);
        if (!conn) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Not connected to ${domain}. Use 'auth' to connect first.`,
              },
            ],
            isError: true,
          };
        }

        const text = conn.subscription
          ? `${conn.service_name} — Plan: ${conn.subscription.plan} [${conn.subscription.status}]`
          : `${conn.service_name} — No active subscription.`;

        return { content: [{ type: "text" as const, text }] };
      }

      // Perform action (requires user confirmation)
      const text = [
        `Subscription management for ${domain}:`,
        ``,
        `  Action: ${action}`,
        plan ? `  Target plan: ${plan}` : null,
        ``,
        `  This action requires user confirmation via push notification or browser.`,
        action === "cancel" ? `  Cancel: ends your current plan at end of billing period.` : null,
        action === "upgrade" ? `  Upgrade: moves to ${plan ?? "a higher"} plan (prorated).` : null,
        action === "downgrade" ? `  Downgrade: moves to ${plan ?? "a lower"} plan at next billing cycle.` : null,
        ``,
        `  The user will be prompted to confirm this change.`,
      ]
        .filter((l) => l !== null)
        .join("\n");

      return { content: [{ type: "text" as const, text }] };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Subscription management failed: ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Tool 6: list_connections ───────────────────────────────────────

server.registerTool(
  "list_connections",
  {
    description: "List all connected services with auth status, scopes, and subscription info. " +
      "Provide a domain for detailed info on a specific connection.",
    inputSchema: {
      domain: z.string().optional().describe("Specific domain for detailed info"),
    },
  },
  async ({ domain }) => {
    try {
      if (domain) {
        const conn = getConnection(domain);
        const token = getToken(domain);

        if (!conn && !token) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Not connected to ${domain}. Use 'auth' to connect.`,
              },
            ],
          };
        }

        const tokenStatus = token?.access_token
          ? token.expires_at
            ? Date.now() < token.expires_at
              ? `Valid (expires ${new Date(token.expires_at).toISOString()})`
              : "Expired — will auto-refresh on next call"
            : "Valid (no expiry)"
          : "No token";

        const identity = getIdentity();

        const text = [
          `Connection: ${conn?.service_name ?? domain}`,
          `  Domain: ${domain}`,
          `  Auth type: ${conn?.auth_type ?? token?.type ?? "unknown"}`,
          `  Token: ${tokenStatus}`,
          token?.scopes?.length ? `  Scopes: ${token.scopes.join(", ")}` : null,
          conn?.subscription
            ? `  Subscription: ${conn.subscription.plan} [${conn.subscription.status}]`
            : `  Subscription: None`,
          conn?.connected_at ? `  Connected since: ${conn.connected_at}` : null,
          identity ? `  Cloud synced: Yes (${identity.email})` : `  Cloud synced: No (run 'agent-gateway init' to enable)`,
        ]
          .filter((l) => l !== null)
          .join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      // List all
      const connections = getAllConnections();
      const tokens = getAllTokens();
      const allDomains = new Set([
        ...connections.map((c) => c.domain),
        ...tokens.map((t) => t.domain),
      ]);

      if (allDomains.size === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No connections yet.\n\nUse 'discover' to find services, then 'auth' or 'call' to connect.",
            },
          ],
        };
      }

      const identity = getIdentity();
      const syncLine = identity
        ? `\nCloud sync: Active (${identity.email})`
        : "\nCloud sync: Not configured (run 'agent-gateway init' to enable)";

      const list = [...allDomains]
        .map((d) => {
          const conn = getConnection(d);
          const token = getToken(d);
          const status = token?.access_token ? "connected" : "expired";
          const sub = conn?.subscription
            ? ` | ${conn.subscription.plan}`
            : "";
          return `  ${conn?.service_name ?? d} (${d}) [${status}]${sub}`;
        })
        .join("\n");

      return {
        content: [
          {
            type: "text" as const,
            text: `Connected services (${allDomains.size}):\n\n${list}${syncLine}\n\nUse list_connections with a domain for details.`,
          },
        ],
      };
    } catch (err) {
      return {
        content: [
          {
            type: "text" as const,
            text: `Failed to list connections: ${err instanceof Error ? err.message : "unknown error"}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// ─── Start ──────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`Gateway MCP fatal error: ${err}\n`);
  process.exit(1);
});
