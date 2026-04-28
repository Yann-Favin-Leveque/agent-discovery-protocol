#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  discoverByQuery,
  fetchManifest,
  fetchCapabilityDetail,
  pickTopCapabilities,
  fetchTopCapabilityDetails,
  pickTopEnabledServices,
  countEnabledServices,
} from "./discovery.js";
import { callCapability } from "./caller.js";
import { listCredentials } from "./credentials.js";
import {
  getToken,
  getConnection,
  getAllConnections,
  getAllTokens,
  getIdentity,
  setRegistryUrl,
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

// ─── Empty-state helper ──────────────────────────────────────────

const EMPTY_STATE_MESSAGE = [
  "No services enabled yet.",
  "",
  "To enable services, the user must run this command in a terminal:",
  "",
  "    agent-gateway config",
  "",
  "This opens a setup page where they can sign in, add a payment method",
  "(for paid services), and toggle the services they want available to agents.",
  "",
  "Once done, those services will appear here automatically.",
].join("\n");

// ─── Tool 1: discover ───────────────────────────────────────────────

server.registerTool(
  "discover",
  {
    description:
      "Browse and search services available to the user. " +
      "Call with no arguments to see the user's enabled services (top by recent usage). " +
      "Use `query` to search across enabled services by intent (e.g. 'send email'). " +
      "Use `domain` to fetch a specific service's manifest, or `domain` + `capability` for full details. " +
      "Set `browse_catalog: true` to search the entire registry beyond what the user has enabled — " +
      "results outside the enabled set are marked [NOT ENABLED] and cannot be called until the user enables them.",
    inputSchema: {
      query: z.string().optional().describe("Natural language search (e.g. 'send email', 'create invoice')"),
      domain: z.string().optional().describe("Specific domain to explore (e.g. 'api.stripe.com')"),
      capability: z.string().optional().describe("Capability name to drill into (requires domain)"),
      resource: z.string().optional().describe("Filter capabilities by resource group (e.g. 'messages', 'users')"),
      force_refresh: z.boolean().optional().describe("Bypass cache and fetch fresh data (default: false)"),
      browse_catalog: z.boolean().optional().describe(
        "Search the full registry catalog beyond enabled services. " +
        "Non-enabled results are read-only — the agent must ask the user to enable them via `agent-gateway config`."
      ),
    },
  },
  async ({ query, domain, capability, resource, force_refresh, browse_catalog }) => {
    try {
      const enabledDomains = new Set(Object.keys(listCredentials()));

      // Mode 0: cold-start — no args, return top-K enabled services
      if (!query && !domain && !capability) {
        const total = countEnabledServices();
        if (total === 0) {
          return { content: [{ type: "text" as const, text: EMPTY_STATE_MESSAGE }] };
        }

        const top = pickTopEnabledServices(8);
        const lines = top.map((c, i) => {
          const usage = c.call_count
            ? ` (${c.call_count} call${c.call_count === 1 ? "" : "s"})`
            : "";
          return `  ${i + 1}. ${c.domain} — ${c.service_name}${usage}`;
        });

        const text = [
          `${total} service${total === 1 ? "" : "s"} enabled. Top by recent usage:`,
          ``,
          ...lines,
          ``,
          `Use discover(query="...") to search across enabled services.`,
          `Use discover(domain="<domain>") to see a service's capabilities.`,
          `Use discover(query="...", browse_catalog=true) to browse the full catalog of unenabled services.`,
        ].join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      // Mode 1: Search by query
      if (query && !domain) {
        if (enabledDomains.size === 0 && !browse_catalog) {
          return { content: [{ type: "text" as const, text: EMPTY_STATE_MESSAGE }] };
        }

        const results = await discoverByQuery(query, { include_unverified: false, force_refresh });

        // Filter to enabled-only by default; browse_catalog opts into full catalog
        const filtered = browse_catalog
          ? results.data
          : results.data.filter((r) => enabledDomains.has(r.service.domain));

        if (filtered.length === 0) {
          if (browse_catalog) {
            return {
              content: [
                {
                  type: "text" as const,
                  text: `No services found in the full catalog for "${query}". Try different keywords.`,
                },
              ],
            };
          }
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `No enabled services match "${query}".\n\n` +
                  `Try discover(query="${query}", browse_catalog=true) to search the full catalog ` +
                  `(${results.result_count} result${results.result_count === 1 ? "" : "s"} ` +
                  `available there). Then ask the user to run \`agent-gateway config\` to enable any you want.`,
              },
            ],
          };
        }

        const text = filtered
          .map((r) => {
            const isEnabled = enabledDomains.has(r.service.domain);
            const status = isEnabled ? "" : " [NOT ENABLED]";
            const trustLevel = r.service.trust_level ?? (r.service.verified ? "verified" : "unverified");
            const trustBadge =
              trustLevel === "verified"
                ? "✅ Verified"
                : trustLevel === "community"
                ? "🔵 Community"
                : "⚠️ Unverified";
            const caps = r.matching_capabilities.length > 0
              ? r.matching_capabilities.map((c) => `    - ${c.name}: ${c.description}`).join("\n")
              : "    (no matching capabilities)";

            return [
              `${trustBadge} ${r.service.name} (${r.service.domain})${status}`,
              `  ${r.service.description}`,
              `  Auth: ${r.service.auth_type} | Pricing: ${r.service.pricing_type}`,
              `  Capabilities:`,
              caps,
            ].join("\n");
          })
          .join("\n\n");

        const header = browse_catalog
          ? `Found ${filtered.length} service(s) for "${query}" (full catalog):`
          : `Found ${filtered.length} enabled service(s) for "${query}":`;

        return {
          content: [{ type: "text" as const, text: `${header}\n\n${text}` }],
        };
      }

      // Mode 2: Fetch specific domain's manifest
      if (domain && !capability) {
        const isEnabled = enabledDomains.has(domain);
        if (!isEnabled && !browse_catalog) {
          return {
            content: [
              {
                type: "text" as const,
                text:
                  `${domain} is not enabled.\n\n` +
                  `Use discover(domain="${domain}", browse_catalog=true) to see its capabilities anyway, ` +
                  `or ask the user to run \`agent-gateway config\` to enable it.`,
              },
            ],
          };
        }

        const manifest = await fetchManifest(domain, { force_refresh });
        const status = isEnabled ? "" : " [NOT ENABLED]";

        let capsSection: string;
        const allCaps = manifest.capabilities;

        if (resource) {
          const resourceLower = resource.toLowerCase();
          const filtered = allCaps.filter(
            (c) => c.resource_group && c.resource_group.toLowerCase().includes(resourceLower)
          );

          if (filtered.length === 0) {
            const groups = new Set<string>();
            for (const c of allCaps) {
              groups.add(c.resource_group ?? "other");
            }
            capsSection = [
              `No capabilities matching resource "${resource}".`,
              ``,
              `Available resource groups: ${[...groups].join(", ")}`,
            ].join("\n");
          } else {
            capsSection = [
              `Capabilities matching "${resource}" (${filtered.length}):`,
              ``,
              ...filtered.map((c) => `  - ${c.name}: ${c.description}`),
            ].join("\n");
          }
        } else if (allCaps.length >= 15) {
          const groups = new Map<string, typeof allCaps>();
          for (const c of allCaps) {
            const group = c.resource_group ?? "other";
            if (!groups.has(group)) {
              groups.set(group, []);
            }
            groups.get(group)!.push(c);
          }

          const groupLines: string[] = [];
          for (const [group, caps] of groups) {
            groupLines.push(`  ${group} (${caps.length} operations):`);
            for (const c of caps) {
              groupLines.push(`    - ${c.name}: ${c.description}`);
            }
            groupLines.push(``);
          }

          capsSection = [
            `Capabilities (${allCaps.length} total):`,
            ``,
            ...groupLines,
          ].join("\n");
        } else {
          capsSection = [
            `Capabilities:`,
            ...allCaps.map((c) => `  - ${c.name}: ${c.description}`),
          ].join("\n");
        }

        // Fetch top capabilities inline (best-effort, parallel)
        let topSection = "";
        if (!resource) {
          const topNames = pickTopCapabilities(allCaps, 3);
          if (topNames.length > 0) {
            const topDetails = await fetchTopCapabilityDetails(domain, topNames, { force_refresh });
            if (topDetails.length > 0) {
              const topLines = topDetails.map((d) => {
                const fullUrl = d.endpoint.startsWith("http") ? d.endpoint : `${manifest.base_url}${d.endpoint}`;
                const params = d.parameters
                  .map((p) => `      ${p.name} (${p.type}${p.required ? ", required" : ""}): ${p.description}`)
                  .join("\n");
                return [
                  `  ${d.name}: ${d.description}`,
                  `    ${d.method} ${fullUrl}`,
                  `    Parameters:`,
                  params,
                ].join("\n");
              });
              topSection = [
                ``,
                `Top capabilities (ready to call):`,
                ...topLines,
              ].join("\n");
            }
          }
        }

        const callHint = isEnabled
          ? `To use a capability, call the 'call' tool with domain="${domain}" and the capability name.`
          : `To use these capabilities, ask the user to enable ${domain} via \`agent-gateway config\`.`;

        const text = [
          `${manifest.name} (${domain})${status}`,
          `${manifest.description}`,
          ``,
          `Base URL: ${manifest.base_url}`,
          `Auth: ${manifest.auth.type}`,
          manifest.pricing ? `Pricing: ${manifest.pricing.type}` : null,
          `Spec version: ${manifest.spec_version}`,
          ``,
          capsSection,
          topSection || null,
          ``,
          callHint,
          `To see full details on a capability, call 'discover' with domain="${domain}" and capability="<name>".`,
          allCaps.length >= 15 && !resource ? `Use discover(domain="${domain}", resource="<group>") to filter by resource group.` : null,
        ]
          .filter((l) => l !== null)
          .join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      // Mode 3: Drill into a specific capability
      if (domain && capability) {
        const detail = await fetchCapabilityDetail(domain, capability, { force_refresh });
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
            text:
              "Provide a 'query' to search, a 'domain' to explore a service, or both 'domain' and 'capability' for details. " +
              "Or call discover with no args to see the user's enabled services.",
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
    description:
      "Call a capability on an enabled service. The gateway handles auth, request construction, and execution. " +
      "First use 'discover' to find the service and capability. " +
      "If the service is not enabled, this tool returns an error and the user must run `agent-gateway config` to enable it.",
    inputSchema: {
      domain: z.string().describe("Service domain (e.g. 'api.stripe.com')"),
      capability: z.string().describe("Capability name (e.g. 'create_charge')"),
      params: z.record(z.string(), z.unknown()).optional().describe("Parameters for the capability (key-value object)"),
    },
  },
  async ({ domain, capability, params }) => {
    try {
      const result = await callCapability(domain, capability, params ?? {});

      if (!result.success) {
        let text: string;
        if (result.not_enabled) {
          text = result.error ?? `Service '${domain}' is not enabled.`;
        } else if (result.auth_required) {
          text = `Authentication required for ${domain}.\n\n${result.error}\n\nAsk the user to run \`agent-gateway config\` to (re)connect this service.`;
        } else {
          text = `Call failed: ${result.error}${result.data ? `\n\nResponse:\n${JSON.stringify(result.data, null, 2)}` : ""}`;
        }

        return {
          content: [{ type: "text" as const, text }],
          isError: true,
        };
      }

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

// ─── Tool 3: list_connections ───────────────────────────────────────

server.registerTool(
  "list_connections",
  {
    description:
      "List the user's enabled services with auth and usage status. " +
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
                text: `${domain} is not enabled. Ask the user to run \`agent-gateway config\` to enable it.`,
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

        const text = [
          `Connection: ${conn?.service_name ?? domain}`,
          `  Domain: ${domain}`,
          `  Auth type: ${conn?.auth_type ?? token?.type ?? "unknown"}`,
          `  Token: ${tokenStatus}`,
          token?.scopes?.length ? `  Scopes: ${token.scopes.join(", ")}` : null,
          conn?.connected_at ? `  Connected since: ${conn.connected_at}` : null,
          conn?.call_count !== undefined ? `  Calls (this machine): ${conn.call_count}` : null,
          conn?.last_called_at ? `  Last call: ${conn.last_called_at}` : null,
        ]
          .filter((l) => l !== null)
          .join("\n");

        return { content: [{ type: "text" as const, text }] };
      }

      const enabledDomains = new Set(Object.keys(listCredentials()));
      const connections = getAllConnections();
      const tokens = getAllTokens();
      const allDomains = new Set<string>([
        ...connections.map((c) => c.domain),
        ...tokens.map((t) => t.domain),
      ]);

      // Restrict to enabled
      const visible = [...allDomains].filter((d) => enabledDomains.has(d));

      if (visible.length === 0) {
        return { content: [{ type: "text" as const, text: EMPTY_STATE_MESSAGE }] };
      }

      const list = visible
        .map((d) => {
          const conn = getConnection(d);
          const token = getToken(d);
          const status = token?.access_token ? "connected" : "expired";
          const usage =
            conn?.call_count !== undefined ? ` | ${conn.call_count} call${conn.call_count === 1 ? "" : "s"}` : "";
          return `  ${conn?.service_name ?? d} (${d}) [${status}]${usage}`;
        })
        .join("\n");

      const identity = getIdentity();
      const idLine = identity ? `\nSigned in as ${identity.email}.` : "";

      return {
        content: [
          {
            type: "text" as const,
            text: `Enabled services (${visible.length}):\n\n${list}${idLine}\n\nUsage counts are local to this machine.`,
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
