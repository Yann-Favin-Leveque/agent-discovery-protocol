import Link from "next/link";

function HeroSection() {
  return (
    <section className="relative overflow-hidden pb-20 pt-32">
      {/* Gradient glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2">
        <div className="h-[500px] w-[800px] rounded-full bg-accent/5 blur-[120px]" />
      </div>

      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <div className="mb-6 inline-block rounded-full border border-accent/30 bg-accent/10 px-4 py-1.5 font-mono text-xs text-accent">
          Agent Discovery Protocol v1.0
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-7xl">
          The <span className="text-accent">DNS</span> for AI&nbsp;Agents
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
          Discover any API. Zero installation. One gateway.
          <br />
          Replace all your MCP plugins with a single protocol.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/submit"
            className="rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light"
          >
            Add your service
          </Link>
          <Link
            href="/docs"
            className="rounded-lg border border-white/10 px-6 py-3 font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/5"
          >
            Read the spec
          </Link>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Service adds endpoint",
      description:
        "Any API adds a /.well-known/agent endpoint returning a JSON manifest describing its capabilities. 10 minutes of work.",
      code: "GET /.well-known/agent → { capabilities: [...] }",
    },
    {
      number: "02",
      title: "Registry indexes it",
      description:
        "The registry crawls and indexes the manifest. Services become searchable by intent — not by name.",
      code: 'discover("send email") → [ MailForge, SendGrid, ... ]',
    },
    {
      number: "03",
      title: "Agent discovers & uses",
      description:
        "Any agent finds and calls services through the Gateway MCP. Lazy drill-down fetches only what's needed.",
      code: "call(service, capability, params) → result",
    },
  ];

  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted">
          Three steps. That&apos;s it.
        </p>

        <div className="mt-16 grid gap-8 sm:grid-cols-3">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-white/5 bg-surface-light p-6"
            >
              <span className="font-mono text-sm text-accent">
                {step.number}
              </span>
              <h3 className="mt-3 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.description}
              </p>
              <div className="mt-4 rounded-lg bg-surface p-3">
                <code className="font-mono text-xs text-accent-light">
                  {step.code}
                </code>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ComparisonSection() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Before &amp; after
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted">
          Stop installing MCP servers for every service. One gateway is all you
          need.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2">
          {/* Before — MCP */}
          <div className="rounded-xl border border-red-500/20 bg-surface-light p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-md bg-red-500/10 px-2 py-0.5 font-mono text-xs text-red-400">
                Before
              </span>
              <span className="text-sm text-muted">With MCP plugins</span>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-surface p-4 font-mono text-xs leading-relaxed">
              <code className="text-red-300/80">{`{
  "mcpServers": {
    "gmail": {
      "command": "npx",
      "args": ["@mcp/gmail"],
      "env": { "GMAIL_TOKEN": "..." }
    },
    "stripe": {
      "command": "npx",
      "args": ["@mcp/stripe"],
      "env": { "STRIPE_KEY": "sk_..." }
    },
    "calendar": {
      "command": "npx",
      "args": ["@mcp/gcal"],
      "env": { "GCAL_TOKEN": "..." }
    },
    "weather": {
      "command": "npx",
      "args": ["@mcp/weather"],
      "env": { "WEATHER_KEY": "..." }
    },
    "slack": {
      "command": "npx",
      "args": ["@mcp/slack"],
      "env": { "SLACK_TOKEN": "xoxb-..." }
    }
  }
}`}</code>
            </pre>
            <p className="mt-3 text-xs text-muted">
              5 services = 5 MCP servers, 5 configs, 5 API keys to manage
            </p>
          </div>

          {/* After — Agent Discovery */}
          <div className="rounded-xl border border-accent/20 bg-surface-light p-6">
            <div className="mb-4 flex items-center gap-2">
              <span className="rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                After
              </span>
              <span className="text-sm text-muted">
                With Agent Discovery
              </span>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-surface p-4 font-mono text-xs leading-relaxed">
              <code className="text-accent-light">{`{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["@agentdns/gateway"]
    }
  }
}`}</code>
            </pre>
            <p className="mt-3 text-xs text-muted">
              1 gateway. All services discovered at runtime. Auth handled
              centrally.
            </p>

            <div className="mt-4 rounded-lg border border-white/5 bg-surface p-4">
              <p className="mb-2 font-mono text-xs text-muted">
                Then your agent just says:
              </p>
              <code className="font-mono text-xs text-accent-light">
                {`> "Send an email to Alice about tomorrow's meeting"`}
              </code>
              <p className="mt-2 font-mono text-xs text-muted">
                Gateway discovers email service → authenticates → sends.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsSection() {
  const stats = [
    { value: "—", label: "Services indexed" },
    { value: "—", label: "Capabilities available" },
    { value: "6", label: "Gateway tools needed" },
    { value: "1", label: "Spec version" },
  ];

  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="font-mono text-3xl font-bold text-accent">
                {stat.value}
              </div>
              <div className="mt-1 text-sm text-muted">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CtaSection() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="text-3xl font-bold sm:text-4xl">
          Make your API discoverable
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Add a single JSON endpoint to your API. Any AI agent in the world can
          find and use your service — no SDK, no plugin, no marketplace
          approval.
        </p>

        <div className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
          <pre className="overflow-x-auto text-left font-mono text-sm leading-relaxed">
            <code>
              <span className="text-muted">{"// That's all it takes"}</span>
              {"\n"}
              <span className="text-accent">
                {"app.get('/.well-known/agent', (req, res) => {"}
              </span>
              {"\n"}
              <span className="text-foreground">
                {"  res.json(manifest);"}
              </span>
              {"\n"}
              <span className="text-accent">{"});"}</span>
            </code>
          </pre>
        </div>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/submit"
            className="rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light"
          >
            Submit your service
          </Link>
          <a
            href="https://github.com/Yann-Favin-Leveque/agent-discovery-protocol/tree/main/spec"
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-lg border border-white/10 px-6 py-3 font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/5"
          >
            Read the spec &rarr;
          </a>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <ComparisonSection />
      <StatsSection />
      <CtaSection />
    </>
  );
}
