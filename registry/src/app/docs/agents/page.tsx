import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Agent Developers — AgentDNS",
  description:
    "Give your agent access to every API. Use the Gateway MCP, query the registry API, or fetch manifests directly.",
};

function CodeBlock({ children, title }: { children: string; title?: string }) {
  return (
    <div className="rounded-xl border border-white/5 bg-surface">
      {title && (
        <div className="border-b border-white/5 px-4 py-2">
          <span className="font-mono text-xs text-muted">{title}</span>
        </div>
      )}
      <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
        <code className="text-accent-light">{children}</code>
      </pre>
    </div>
  );
}

export default function AgentsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/docs"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Docs
      </Link>

      <h1 className="mt-6 text-4xl font-bold">
        Give your agent access to every API
      </h1>
      <p className="mt-4 text-lg text-muted">
        Three ways to integrate, from zero-effort to full control.
      </p>

      {/* Option A */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
            Recommended
          </span>
          <h2 className="text-2xl font-bold">
            Option A: Use the Gateway MCP
          </h2>
        </div>
        <p className="mt-4 text-muted">
          The fastest path. Install one MCP server and your agent can discover
          and use any API — no per-service plugins, no configuration files.
        </p>

        <div className="mt-6">
          <CodeBlock title="Install">{`npm install -g agent-gateway-mcp
agent-gateway init   # Sign in with Google → done`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="MCP client config (Claude Desktop, Cursor, etc.)">{`{
  "mcpServers": {
    "gateway": {
      "command": "agent-gateway-mcp"
    }
  }
}`}</CodeBlock>
        </div>

        <p className="mt-4 text-sm text-muted">
          That&apos;s it. Your agent now has 6 tools:
        </p>

        <div className="mt-4 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">discover</td>
                <td className="py-2 text-muted">
                  Search services by intent, explore domains, drill into
                  capabilities
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">call</td>
                <td className="py-2 text-muted">
                  Call any capability — auth, request building, and execution
                  handled automatically
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">auth</td>
                <td className="py-2 text-muted">
                  Connect to services via OAuth2 or API key
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">subscribe</td>
                <td className="py-2 text-muted">
                  Subscribe to paid service plans (with user confirmation)
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">
                  manage_subscriptions
                </td>
                <td className="py-2 text-muted">
                  List, cancel, upgrade, or downgrade subscriptions
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">
                  list_connections
                </td>
                <td className="py-2 text-muted">
                  View connected services, token status, and subscription info
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <CodeBlock title="Example conversation">{`User: "Send an invoice to Acme Corp for $5,000"

Agent → discover({ query: "create invoice" })
Agent → discover({ domain: "api.invoiceninja.com", capability: "create_invoice" })
Agent → call({
  domain: "api.invoiceninja.com",
  capability: "create_invoice",
  params: { client_name: "Acme Corp", amount: 500000, currency: "USD" }
})

Agent: "Done! Invoice INV-2024-0042 sent to Acme Corp."`}</CodeBlock>
        </div>
      </section>

      {/* Option B */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">
          Option B: Query the registry API directly
        </h2>
        <p className="mt-4 text-muted">
          If you&apos;re building your own agent framework, use the registry REST
          API to discover services.
        </p>

        <div className="mt-6">
          <CodeBlock title="Search for services (TypeScript)">{`const res = await fetch(
  "https://agentdns.dev/api/discover?q=send+email"
);
const { data } = await res.json();

// data = [
//   {
//     service: { name: "MailForge", domain: "api.mailforge.dev", ... },
//     matching_capabilities: [
//       { name: "send_email", description: "Send an email", detail_url: "..." }
//     ]
//   }
// ]`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="Fetch a service's manifest">{`const manifest = await fetch(
  "https://api.mailforge.dev/.well-known/agent"
).then(r => r.json());

// manifest.capabilities → list of all capabilities
// Each has a detail_url for drill-down`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="Drill into a capability">{`const detail = await fetch(
  "https://api.mailforge.dev/api/capabilities/send_email"
).then(r => r.json());

// detail.endpoint → "/v1/messages/send"
// detail.method → "POST"
// detail.parameters → [{ name: "to", type: "string", required: true, ... }]
// detail.request_example → full example request
// detail.response_example → full example response`}</CodeBlock>
        </div>

        <p className="mt-4 text-sm text-muted">
          See the full{" "}
          <Link href="/docs/api" className="text-accent hover:underline">
            API Reference
          </Link>{" "}
          for all endpoints.
        </p>
      </section>

      {/* Option C */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">
          Option C: Fetch manifests directly
        </h2>
        <p className="mt-4 text-muted">
          If you already know which services you want, skip the registry and
          fetch <code className="text-accent">/.well-known/agent</code> directly.
        </p>

        <div className="mt-6">
          <CodeBlock title="Python">{`import httpx

# Fetch the manifest
manifest = httpx.get("https://api.example.com/.well-known/agent").json()

# Find the capability you need
cap = next(c for c in manifest["capabilities"] if c["name"] == "send_email")

# Fetch its details
detail_url = f"{manifest['base_url']}{cap['detail_url']}"
detail = httpx.get(detail_url).json()

# Now you know the endpoint, method, parameters, and examples
print(f"{detail['method']} {detail['endpoint']}")
print(f"Params: {[p['name'] for p in detail['parameters']]}")`}</CodeBlock>
        </div>

        <p className="mt-4 text-sm text-muted">
          This is the lowest-level approach. You handle discovery, auth, and
          request construction yourself. Good for simple integrations or when
          you want full control.
        </p>
      </section>

      {/* Which to choose */}
      <section className="mt-16 rounded-xl border border-white/5 bg-surface-light p-8">
        <h2 className="text-xl font-bold">Which option should I use?</h2>
        <div className="mt-4 space-y-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-accent">A</span>
            <p className="text-muted">
              <strong className="text-foreground">Gateway MCP</strong> — Use
              this if you&apos;re using Claude, GPT, or any MCP-compatible agent.
              Zero code, maximum capability.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-accent">B</span>
            <p className="text-muted">
              <strong className="text-foreground">Registry API</strong> — Use
              this if you&apos;re building your own agent framework and want
              semantic search across all registered services.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="mt-1 font-mono text-accent">C</span>
            <p className="text-muted">
              <strong className="text-foreground">Direct fetch</strong> — Use
              this for simple scripts, known services, or when you want full
              control over the integration.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
