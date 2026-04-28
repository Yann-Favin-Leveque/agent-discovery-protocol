import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Agent Developers — AgentDNS",
  description:
    "Install the gateway, sign in once, add a card. Your agent gets access to 25+ services without managing API keys.",
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

      <h1 className="mt-6 text-4xl font-bold">Set up the gateway</h1>
      <p className="mt-4 text-lg text-muted">
        AgentDNS is a unified MCP gateway. Install once, configure once. Your
        agent gets access to 25+ services through one MCP server, billed
        through one card.
      </p>

      {/* What it is */}
      <section className="mt-12 rounded-xl border border-accent/20 bg-accent/5 p-6">
        <p className="text-sm text-muted">
          The gateway is the only MCP server you need. It handles discovery,
          auth, and billing across every service. No per-service plugin.
          No per-service API key. Your agent only sees the services you&apos;ve
          enabled — no context bloat from 242 unused tools.
        </p>
      </section>

      {/* 1. Install */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
            1
          </span>
          <h2 className="text-2xl font-bold">Install</h2>
        </div>
        <div className="mt-6">
          <CodeBlock>{`npm install -g agent-gateway-mcp`}</CodeBlock>
        </div>
      </section>

      {/* 2. Configure */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
            2
          </span>
          <h2 className="text-2xl font-bold">Configure</h2>
        </div>
        <p className="mt-4 text-muted">
          Run the config command. It opens a local web page in your browser.
        </p>
        <div className="mt-6">
          <CodeBlock>{`agent-gateway config`}</CodeBlock>
        </div>

        <p className="mt-6 text-muted">In the page you will:</p>
        <ul className="mt-4 space-y-3 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">Sign in with Google.</strong>{" "}
              This links your gateway to your AgentDNS account.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">Add a card.</strong> Required
              only for paid services. Free services work without a payment
              method.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">Toggle services on / off.</strong>{" "}
              For OAuth services (Gmail, GitHub, Notion...) one click runs
              the OAuth flow. For BYO API key services, paste your key
              following the per-service setup guide.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">Set spending caps.</strong>{" "}
              Optional per-service monthly cap, e.g. &quot;max $10 / month on
              OpenAI&quot;.
            </span>
          </li>
        </ul>
      </section>

      {/* 3. Wire it in */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
            3
          </span>
          <h2 className="text-2xl font-bold">Wire it into your MCP client</h2>
        </div>
        <p className="mt-4 text-muted">
          Add the gateway to your client&apos;s MCP server config.
        </p>

        <div className="mt-6">
          <CodeBlock title="Claude Code">{`claude mcp add gateway -- agent-gateway-mcp`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="Claude Desktop, Cursor, Windsurf, Zed">{`{
  "mcpServers": {
    "gateway": {
      "command": "agent-gateway-mcp"
    }
  }
}`}</CodeBlock>
        </div>
      </section>

      {/* 4. Test */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
            4
          </span>
          <h2 className="text-2xl font-bold">Test it</h2>
        </div>
        <p className="mt-4 text-muted">
          Restart your MCP client and ask your agent something.
        </p>
        <div className="mt-6">
          <CodeBlock title="Example session">{`User: "Send an email to alice@example.com about tomorrow's meeting"

Agent → discover({ query: "send email" })
Gateway returns: gmail (enabled), slack (enabled)

Agent → call({
  domain: "gmail.googleapis.com",
  capability: "users_messages_send",
  params: { to: "alice@example.com", subject: "...", body: "..." }
})

Gateway calls Gmail with your OAuth token. Records usage.

Agent: "Done — email sent."`}</CodeBlock>
        </div>
      </section>

      {/* What the agent sees */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">What the agent sees</h2>
        <p className="mt-4 text-muted">
          The gateway exposes three tools. Your agent uses these — it never
          touches credentials directly.
        </p>

        <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 pr-4 align-top font-mono text-accent">discover</td>
                <td className="py-2 text-muted">
                  Browse and search the catalog. By default returns only the
                  services you&apos;ve enabled. Pass <code className="text-accent">browse_catalog=true</code>{" "}
                  to search the full 242-service catalog (results are marked
                  as not enabled and cannot be called until you enable them).
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-top font-mono text-accent">call</td>
                <td className="py-2 text-muted">
                  Execute a capability. Auth is handled automatically: OAuth
                  tokens refresh transparently, API keys inject from your
                  enablement, usage is metered. Calling a non-enabled service
                  returns a clear error asking the user to enable it.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-4 align-top font-mono text-accent">list_connections</td>
                <td className="py-2 text-muted">
                  Show what&apos;s enabled, what&apos;s connected (auth done),
                  and which services still need setup.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-5">
          <h3 className="font-semibold">Empty state</h3>
          <p className="mt-2 text-sm text-muted">
            If you haven&apos;t enabled any services yet, every{" "}
            <code className="text-accent">discover</code> call returns:
          </p>
          <p className="mt-3 rounded-lg bg-surface p-3 font-mono text-xs text-muted">
            No services enabled yet. Run{" "}
            <span className="text-accent">agent-gateway config</span> in a
            terminal to sign in, add a payment method, and toggle services on.
          </p>
        </div>
      </section>

      {/* Pricing & billing */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Pricing &amp; billing</h2>
        <p className="mt-4 text-muted">
          Pay-per-use. No subscriptions. We act as the merchant for every
          paid service in v1 — you pay us, we pay providers.
        </p>

        <ul className="mt-6 space-y-3 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>
              <strong className="text-foreground">Free services are free.</strong>{" "}
              Things like OpenWeatherMap free tier, Gmail (under your own quota),
              etc. — no card needed.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>
              <strong className="text-foreground">Paid services are passthrough + ~15% markup.</strong>{" "}
              You pay slightly above provider cost. No bundled monthly fees.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>
              <strong className="text-foreground">Monthly invoice via Stripe.</strong>{" "}
              One charge per month covering everything you used. View
              line-by-line history in the Stripe customer portal.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>
              <strong className="text-foreground">Per-service spending caps.</strong>{" "}
              Set a hard monthly cap in <code className="text-accent">agent-gateway config</code>.
              When hit, the gateway refuses further calls to that service until
              next month.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>
              <strong className="text-foreground">Catalog-only services.</strong>{" "}
              For the ~217 services that aren&apos;t billable through us yet,
              you can still enable them with your own API key (BYO key) — we
              don&apos;t handle billing, you call your own provider account
              through the gateway.
            </span>
          </li>
        </ul>

        <p className="mt-6 text-sm text-muted">
          By using the gateway you agree to our Acceptable Use Policy. See{" "}
          <Link href="/aup" className="text-accent hover:underline">
            /aup
          </Link>
          .
        </p>
      </section>

      {/* Trust signals */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Trust signals</h2>
        <p className="mt-4 text-muted">
          Each service in the catalog has a trust level. The gateway prefers
          verified services in search results.
        </p>
        <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-5">
          <div className="space-y-2 text-sm text-muted">
            <p>
              <span className="text-accent font-mono">[VERIFIED]</span> — Service
              hosts its own manifest, crawled periodically.
            </p>
            <p>
              <span className="text-blue-400 font-mono">[COMMUNITY]</span> —
              Manifest maintained by AgentDNS based on the service&apos;s public
              docs.
            </p>
            <p>
              <span className="text-yellow-400 font-mono">[UNVERIFIED]</span> —
              Newly submitted, hidden from search by default.
            </p>
          </div>
          <p className="mt-3 text-sm text-muted">
            More detail in{" "}
            <Link href="/docs/trust-levels" className="text-accent hover:underline">
              trust levels
            </Link>
            .
          </p>
        </div>
      </section>

      {/* FAQ / Troubleshooting */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Troubleshooting</h2>

        <div className="mt-6 space-y-6">
          <div>
            <h3 className="font-semibold">
              The agent says &quot;no services enabled&quot;.
            </h3>
            <p className="mt-2 text-sm text-muted">
              Run <code className="text-accent">agent-gateway config</code> and
              toggle on at least one service.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">
              How do I revoke access to a service?
            </h3>
            <p className="mt-2 text-sm text-muted">
              Run <code className="text-accent">agent-gateway config</code> and
              toggle the service off. The gateway revokes its OAuth token (if
              applicable) and clears the BYO key. Any in-flight call fails
              cleanly with an &quot;not enabled&quot; error.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">
              The agent wants to use a service I haven&apos;t enabled.
            </h3>
            <p className="mt-2 text-sm text-muted">
              The gateway returns an error explaining the service is in the
              catalog but not enabled. The agent should tell you in
              conversation. Open <code className="text-accent">agent-gateway config</code>{" "}
              and enable it.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">
              Where are my credentials stored?
            </h3>
            <p className="mt-2 text-sm text-muted">
              Locally, in <code className="text-accent">~/.agent-gateway/</code>.
              Cards are stored in Stripe (we never see them). OAuth tokens and
              BYO API keys live on your machine, not synced to any server.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">
              Can I see month-to-date usage from the CLI?
            </h3>
            <p className="mt-2 text-sm text-muted">
              The config page shows usage from this machine. Authoritative
              billing data lives in your{" "}
              <a
                href="/account"
                className="text-accent hover:underline"
              >
                account
              </a>
              {" "}via the Stripe customer portal. Cross-machine in-CLI
              aggregation is planned for a later release.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">
              Where do I get help?
            </h3>
            <p className="mt-2 text-sm text-muted">
              Email{" "}
              <a
                href="mailto:support@agent-dns.dev"
                className="text-accent hover:underline"
              >
                support@agent-dns.dev
              </a>
              .
            </p>
          </div>
        </div>
      </section>

      {/* For framework builders */}
      <section className="mt-16 rounded-xl border border-white/5 bg-surface-light p-6">
        <h2 className="text-xl font-bold">Building your own agent framework?</h2>
        <p className="mt-3 text-sm text-muted">
          You can hit the registry REST API directly to discover services and
          fetch capability details. See the{" "}
          <Link href="/docs/api" className="text-accent hover:underline">
            API reference
          </Link>
          {" "}for endpoints. Note that authenticated endpoints (enablement,
          billing) require a registry JWT — issued from the same OAuth flow as{" "}
          <code className="text-accent">agent-gateway config</code>.
        </p>
      </section>
    </div>
  );
}
