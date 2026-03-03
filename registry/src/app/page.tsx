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
        "Install an SDK for Express, FastAPI, Next.js, or Spring Boot. Define your capabilities and the SDK serves a /.well-known/agent manifest automatically.",
      code: "GET /.well-known/agent → { capabilities: [...] }",
    },
    {
      number: "02",
      title: "Registry indexes it",
      description:
        "The registry crawls and indexes the manifest. Verified and community-trusted services are prioritized. Services become searchable by intent — not by name.",
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
              1 gateway. All services discovered at runtime. Credentials
              stored locally, setup guided step by step.
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

function ForAgentsSection() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="grid gap-12 sm:grid-cols-2 items-center">
          <div>
            <div className="mb-4 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
              For Agent Developers
            </div>
            <h2 className="text-3xl font-bold sm:text-4xl">
              Set up once, access every&nbsp;API
            </h2>
            <p className="mt-4 text-muted">
              Install one gateway. Add it to your MCP config. That&apos;s it.
              Your agent can now discover and use any API — no per-service
              plugins, no config files. When you first use a service, the
              gateway walks you through credential setup step by step.
            </p>

            <div className="mt-8">
              <Link
                href="/docs/agents"
                className="rounded-lg bg-accent px-5 py-2.5 font-medium text-black transition-colors hover:bg-accent-light"
              >
                View integration guide
              </Link>
            </div>
          </div>

          <div className="space-y-4">
            {/* Step 1 */}
            <div className="rounded-xl border border-white/5 bg-surface-light p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent">
                  1
                </span>
                <span className="text-sm font-medium">Install the gateway</span>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs leading-relaxed">
                <code className="text-accent-light">npm install -g agent-gateway-mcp</code>
              </pre>
            </div>

            {/* Step 2 */}
            <div className="rounded-xl border border-white/5 bg-surface-light p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent">
                  2
                </span>
                <span className="text-sm font-medium">Add to your MCP config</span>
              </div>
              <pre className="mt-3 overflow-x-auto rounded-lg bg-surface p-3 font-mono text-xs leading-relaxed">
                <code className="text-accent-light">{`{
  "mcpServers": {
    "gateway": {
      "command": "npx",
      "args": ["agent-gateway-mcp"]
    }
  }
}`}</code>
              </pre>
            </div>

            {/* Step 3 */}
            <div className="rounded-xl border border-accent/20 bg-surface-light p-5">
              <div className="flex items-center gap-2">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-accent/10 font-mono text-xs font-bold text-accent">
                  3
                </span>
                <span className="text-sm font-medium">That&apos;s it. Your agent can now discover and use any API.</span>
              </div>
              <div className="mt-3 rounded-lg border border-white/5 bg-surface p-3">
                <p className="font-mono text-xs text-foreground">
                  {`> "Send an email to Alice about tomorrow's meeting"`}
                </p>
                <p className="mt-2 font-mono text-xs text-muted">
                  Gateway discovers &rarr; authenticates &rarr; sends. Done.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ForProvidersSection() {
  const sdks = [
    {
      framework: "Express.js",
      pkg: "agent-well-known-express",
      code: `const { agentManifest } = require('agent-well-known-express');

app.use(agentManifest({
  name: "My API",
  description: "What my API does.",
  base_url: "https://api.example.com",
  auth: { type: "api_key", header: "Authorization" },
  capabilities: [{ name: "send_email", ... }]
}));`,
    },
    {
      framework: "FastAPI",
      pkg: "agent-well-known-fastapi",
      code: `from agent_well_known import AgentManifest, Capability

manifest = AgentManifest(
    name="My API",
    description="What my API does.",
    base_url="https://api.example.com",
    auth={"type": "api_key", "header": "Authorization"},
    capabilities=[Capability(name="send_email", ...)]
)
manifest.mount(app)`,
    },
    {
      framework: "Next.js",
      pkg: "agent-well-known-next",
      code: `import { createAgentManifest } from 'agent-well-known-next';

// app/.well-known/agent/route.ts
export const GET = createAgentManifest({
  name: "My API",
  description: "What my API does.",
  base_url: "https://api.example.com",
  auth: { type: "api_key", header: "Authorization" },
  capabilities: [{ name: "send_email", ... }]
});`,
    },
    {
      framework: "Spring Boot",
      pkg: "agent-well-known-spring-boot",
      code: `@AgentManifest(
    name = "My API",
    description = "What my API does.",
    baseUrl = "https://api.example.com"
)
@SpringBootApplication
public class MyApp { }`,
    },
  ];

  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
            For Service Providers
          </div>
          <h2 className="text-3xl font-bold sm:text-4xl">
            Add the protocol to your API in one&nbsp;line
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Pick your framework. Define your capabilities. Your API is
            instantly discoverable by every AI agent — no MCP server
            to build, no plugin to maintain.
          </p>
        </div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2">
          {sdks.map((sdk) => (
            <div
              key={sdk.framework}
              className="rounded-xl border border-white/5 bg-surface-light p-5"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-semibold">{sdk.framework}</span>
                <code className="rounded bg-surface px-2 py-0.5 font-mono text-xs text-muted">
                  {sdk.pkg}
                </code>
              </div>
              <pre className="overflow-x-auto rounded-lg bg-surface p-4 font-mono text-xs leading-relaxed">
                <code className="text-accent-light">{sdk.code}</code>
              </pre>
            </div>
          ))}
        </div>

        <div className="mt-8 flex items-center justify-center gap-4">
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
    </section>
  );
}

function VisionSection() {
  const milestones = [
    {
      icon: "\u{1F50D}",
      title: "Discovery",
      status: "Live now",
      statusColor: "bg-accent/10 text-accent",
      description:
        'Agents find your service by intent. "I need to send an invoice" \u2014 your API shows up.',
    },
    {
      icon: "\u{1F511}",
      title: "Managed OAuth",
      status: "Coming soon",
      statusColor: "bg-yellow-500/10 text-yellow-400",
      description:
        "Premium tier: skip credential setup entirely. We handle OAuth apps and API keys so users connect in one click.",
    },
    {
      icon: "\u{1F4DD}",
      title: "Agent onboarding",
      status: "Planned",
      statusColor: "bg-white/5 text-muted",
      description:
        "New users sign up to your service directly through their agent. Zero friction acquisition channel.",
    },
    {
      icon: "\u{1F4B3}",
      title: "In-agent subscriptions",
      status: "Planned",
      statusColor: "bg-white/5 text-muted",
      description:
        "Users approve plans from their agent with biometric confirmation. Payment handled by the registry.",
    },
  ];

  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-5xl px-6">
        {/* Header */}
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
            What&apos;s Next
          </div>
          <h2 className="text-3xl font-bold sm:text-4xl">
            The Future: Frictionless Agent&nbsp;Access
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted">
            Today, agents discover and call your API. Tomorrow, they&apos;ll
            handle everything.
          </p>
        </div>

        {/* Timeline */}
        <div className="relative mt-16">
          {/* Vertical line */}
          <div className="absolute left-6 top-0 hidden h-full w-px bg-gradient-to-b from-accent/40 via-accent/20 to-transparent sm:block" />

          <div className="space-y-6">
            {milestones.map((m, i) => (
              <div key={m.title} className="relative flex gap-6">
                {/* Dot on the line */}
                <div className="relative z-10 hidden sm:block">
                  <div
                    className={`flex h-12 w-12 items-center justify-center rounded-full border text-lg ${
                      i === 0
                        ? "border-accent/40 bg-accent/10"
                        : "border-white/10 bg-surface-light"
                    }`}
                  >
                    {m.icon}
                  </div>
                </div>

                {/* Card */}
                <div
                  className={`flex-1 rounded-xl border p-5 ${
                    i === 0
                      ? "border-accent/20 bg-gradient-to-r from-accent/5 to-transparent"
                      : "border-white/5 bg-surface-light"
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="sm:hidden text-lg">{m.icon}</span>
                    <h3 className="font-semibold">{m.title}</h3>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${m.statusColor}`}
                    >
                      {m.status}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {m.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div className="mt-16 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 via-transparent to-accent/5 p-8 text-center">
          <p className="text-lg font-medium">
            Want to be among the first services to support full agent
            onboarding?
          </p>
          <a
            href="mailto:yann.fl95@gmail.com"
            className="mt-4 inline-block rounded-lg bg-accent px-5 py-2.5 font-medium text-black transition-colors hover:bg-accent-light"
          >
            Get in touch
          </a>
          <p className="mt-6 text-sm text-muted">
            If your service already supports OAuth, you&apos;re ahead of the
            curve. Declare it in your manifest and agents can connect users
            today.
          </p>
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
      value: String(dbStats.trusted_services || 0),
      label: "Trusted services",
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
        <p className="mt-8 text-center text-sm text-muted">
          Verified services are actively monitored.{" "}
          <Link href="/status" className="text-accent hover:text-accent-light transition-colors">
            Check real-time status
          </Link>
          {" · "}
          <Link href="/docs/trust-levels" className="text-accent hover:text-accent-light transition-colors">
            Learn about trust levels
          </Link>
        </p>
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
      <ForAgentsSection />
      <ForProvidersSection />
      <VisionSection />
      <StatsSection />
      <CtaSection />
    </>
  );
}
