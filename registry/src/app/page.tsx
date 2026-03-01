import Link from "next/link";
import { getServiceStats } from "@/lib/db";
import { TerminalDemo } from "@/components/terminal-demo";

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
            Read the docs
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

function TerminalDemoSection() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          See it in action
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted">
          One agent, one gateway, any API. Watch the full flow: discover, auth,
          call.
        </p>

        <div className="mt-12">
          <TerminalDemo />
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
      "args": ["agent-gateway-mcp"]
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
                Gateway discovers email service, authenticates, sends.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function WorksWithSection() {
  const llms = [
    { name: "Claude", desc: "Anthropic" },
    { name: "GPT", desc: "OpenAI" },
    { name: "Gemini", desc: "Google" },
    { name: "Llama", desc: "Meta" },
    { name: "Mistral", desc: "Mistral AI" },
    { name: "Any LLM", desc: "Open protocol" },
  ];

  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-4xl px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Works with any LLM
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted">
          Not tied to any provider. Open protocol, works with any agent
          framework.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
          {llms.map((llm) => (
            <div
              key={llm.name}
              className="flex flex-col items-center rounded-xl border border-white/5 bg-surface-light p-4 transition-colors hover:border-accent/20"
            >
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-surface font-mono text-lg font-bold text-accent">
                {llm.name[0]}
              </div>
              <span className="mt-2 text-sm font-medium">{llm.name}</span>
              <span className="text-xs text-muted">{llm.desc}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function ForProvidersSection() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-12 sm:grid-cols-2 items-center">
          <div>
            <div className="mb-4 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
              For Service Providers
            </div>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Your API, discoverable by every AI&nbsp;agent
            </h2>
            <p className="mt-4 text-muted">
              Add one endpoint. That&apos;s it. Your API becomes accessible to
              every agent using the protocol — no SDK to maintain, no plugin to
              build, no marketplace to join.
            </p>

            <div className="mt-8 flex gap-4">
              <Link
                href="/docs/providers"
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-black transition-colors hover:bg-accent-light"
              >
                Get started
              </Link>
              <Link
                href="/playground"
                className="rounded-lg border border-white/10 px-5 py-2.5 font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/5"
              >
                Try the playground
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-white/5 bg-surface-light p-6">
            <pre className="overflow-x-auto font-mono text-sm leading-relaxed">
              <code>
                <span className="text-muted">{"// 10 minutes. That's all."}</span>
                {"\n\n"}
                <span className="text-accent">
                  {"app.get('/.well-known/agent',"}
                </span>
                {"\n"}
                <span className="text-accent">{"  (req, res) => {"}</span>
                {"\n"}
                <span className="text-foreground">
                  {"    res.json({"}
                </span>
                {"\n"}
                <span className="text-foreground">
                  {'      spec_version: "1.0",'}
                </span>
                {"\n"}
                <span className="text-foreground">
                  {'      name: "Your API",'}
                </span>
                {"\n"}
                <span className="text-foreground">
                  {"      capabilities: [...]"}
                </span>
                {"\n"}
                <span className="text-foreground">{"    });"}</span>
                {"\n"}
                <span className="text-accent">{"});"}</span>
              </code>
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}

async function StatsSection() {
  const dbStats = await getServiceStats();
  const stats = [
    {
      value: String(dbStats.total_services || 0),
      label: "Services indexed",
    },
    {
      value: String(dbStats.total_capabilities || 0),
      label: "Capabilities available",
    },
    {
      value: String(dbStats.verified_services || 0),
      label: "Verified services",
    },
    { value: "6", label: "Gateway tools" },
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
          Ready to get started?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          Whether you&apos;re a service provider making your API discoverable, or
          an agent developer connecting to every API — start in minutes.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/submit"
            className="rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light"
          >
            Submit your service
          </Link>
          <Link
            href="/docs/agents"
            className="rounded-lg border border-white/10 px-6 py-3 font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/5"
          >
            Integrate the gateway &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function Home() {
  return (
    <>
      <HeroSection />
      <HowItWorksSection />
      <TerminalDemoSection />
      <ComparisonSection />
      <WorksWithSection />
      <ForProvidersSection />
      <StatsSection />
      <CtaSection />
    </>
  );
}
