import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Service Providers — AgentDNS",
  description:
    "Be discoverable to thousands of AI agents through one gateway. Implement /.well-known/agent, submit, get listed.",
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

export default function ProvidersPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/docs"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Docs
      </Link>

      <h1 className="mt-6 text-4xl font-bold">List your service on AgentDNS</h1>
      <p className="mt-4 text-lg text-muted">
        Be discoverable to every AI agent using the gateway. No MCP server to
        build, no plugin to maintain. Implement one JSON endpoint, submit, and
        you&apos;re in.
      </p>

      {/* What's in it for you */}
      <section className="mt-12 rounded-xl border border-accent/20 bg-accent/5 p-6">
        <h2 className="text-lg font-semibold">What&apos;s in it for you</h2>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              Your API becomes discoverable inside any agent that uses the
              AgentDNS gateway — Claude, Cursor, custom frameworks, etc.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              No MCP server to write or maintain. The gateway translates
              between your manifest and any agent.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              Open protocol. No partnership, no exclusive contract — just a
              public spec and a registry.
            </span>
          </li>
        </ul>
      </section>

      {/* How it works */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">How it works for providers</h2>
        <ol className="mt-6 space-y-4 text-sm text-muted">
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent">
              1
            </span>
            <span>
              Implement{" "}
              <code className="text-accent">/.well-known/agent</code> on your
              service domain. It returns a JSON manifest describing your
              capabilities. See the{" "}
              <Link href="/docs/spec" className="text-accent hover:underline">
                spec
              </Link>{" "}
              for the full schema.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent">
              2
            </span>
            <span>
              Submit your service at{" "}
              <Link href="/submit" className="text-accent hover:underline">
                /submit
              </Link>
              . The registry crawls your manifest and validates it.
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent">
              3
            </span>
            <span>
              We review and list. Verification typically takes ~48h. You get
              an email when it&apos;s done.
            </span>
          </li>
        </ol>
      </section>

      {/* Manifest */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Manifest</h2>
        <p className="mt-4 text-muted">
          A small JSON document describing your API. The gateway uses this to
          tell agents what your service does and how to call it. Each
          capability points to a <code className="text-accent">detail_url</code>{" "}
          for a deeper drill-down (method, parameters, examples) — agents only
          fetch this when needed.
        </p>

        <div className="mt-6">
          <CodeBlock title="Minimal manifest">{`{
  "spec_version": "1.0",
  "name": "My API",
  "description": "What my API does in one sentence.",
  "base_url": "https://api.example.com",
  "auth": { "type": "none" },
  "capabilities": [
    {
      "name": "get_data",
      "description": "Fetch data from the API",
      "detail_url": "/api/capabilities/get_data"
    }
  ]
}`}</CodeBlock>
        </div>

        <p className="mt-4 text-sm text-muted">
          We provide SDKs for Express, FastAPI, Next.js, and Spring Boot that
          generate the endpoints automatically. See the{" "}
          <a
            href="https://github.com/Yann-Favin-Leveque/agent-discovery-protocol/tree/main/spec"
            target="_blank"
            rel="noopener noreferrer"
            className="text-accent hover:underline"
          >
            GitHub repo
          </a>{" "}
          or the{" "}
          <Link href="/docs/spec" className="text-accent hover:underline">
            full spec
          </Link>
          .
        </p>
      </section>

      {/* Pricing & billing */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Pricing &amp; billing</h2>
        <p className="mt-4 text-muted">
          AgentDNS is a single-tenant aggregator: users pay AgentDNS, AgentDNS
          pays providers. There&apos;s no marketplace billing setup for you to
          go through.
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-white/5 bg-surface-light p-5">
            <h3 className="font-semibold">Free services</h3>
            <p className="mt-2 text-sm text-muted">
              Nothing special to do. Users authenticate to your service via
              their own OAuth or your standard auth, through the gateway. We
              never sit in the billing path.
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface-light p-5">
            <h3 className="font-semibold">Paid services (v1)</h3>
            <p className="mt-2 text-sm text-muted">
              In v1, AgentDNS itself is your customer. We open an account on
              your service, hold our own credentials, pay you per our standard
              billing terms, and re-bill our users on top. From your side it
              looks like a single high-volume customer — no per-end-user
              accounts to manage, no Stripe Connect, no marketplace plumbing.
            </p>
            <p className="mt-3 text-sm text-muted">
              We&apos;re working on a partner program for direct billing in a
              future version. It is not available yet.
            </p>
          </div>
          <div className="rounded-xl border border-white/5 bg-surface-light p-5">
            <h3 className="font-semibold">No more Stripe Connect</h3>
            <p className="mt-2 text-sm text-muted">
              The previous marketplace flow (per-provider Stripe Connect onboarding,
              per-user subscriptions) was removed. If you were halfway through that
              setup, you can stop — nothing on your end is required for the v1
              billing model.
            </p>
          </div>
        </div>
      </section>

      {/* Spec */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Spec compliance</h2>
        <p className="mt-4 text-muted">
          The full Agent Discovery Protocol specification:{" "}
          <Link href="/docs/spec" className="text-accent hover:underline">
            /docs/spec
          </Link>
          . It covers the manifest format, the auth object, capability detail
          format, and all required fields.
        </p>
      </section>

      {/* Trust levels */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Trust levels</h2>
        <p className="mt-4 text-muted">
          Each registered service has one of three trust levels. Higher trust
          means better placement in agent search results and active health
          monitoring.
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-accent/20 bg-surface-light p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                Verified
              </span>
              <span className="text-sm text-muted">Highest trust</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Your service hosts its own{" "}
              <code className="text-accent">/.well-known/agent</code>. The
              registry crawls it on a schedule and confirms it&apos;s live.
            </p>
          </div>
          <div className="rounded-xl border border-blue-500/20 bg-surface-light p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-400">
                Community
              </span>
              <span className="text-sm text-muted">Maintained by AgentDNS</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Manifest hand-written by the AgentDNS team based on your public
              docs. No infrastructure change on your side. If you want to
              upgrade to verified, just host the manifest yourself.
            </p>
          </div>
          <div className="rounded-xl border border-yellow-500/20 bg-surface-light p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-sm text-yellow-400">
                Unverified
              </span>
              <span className="text-sm text-muted">Not yet reviewed</span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Newly submitted, awaiting review. Hidden from search by default.
            </p>
          </div>
        </div>

        <p className="mt-4 text-sm text-muted">
          More detail in{" "}
          <Link href="/docs/trust-levels" className="text-accent hover:underline">
            /docs/trust-levels
          </Link>
          .
        </p>
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 via-transparent to-accent/5 p-8 text-center">
        <h2 className="text-2xl font-bold">Get listed</h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
          Implement <code className="text-accent">/.well-known/agent</code>,
          submit your domain, and we&apos;ll review within 48h.
        </p>
        <Link
          href="/submit"
          className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light"
        >
          Submit your service
        </Link>
      </section>
    </div>
  );
}
