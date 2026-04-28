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
          Agent Discovery Protocol — v1
        </div>

        <h1 className="text-5xl font-bold leading-tight tracking-tight sm:text-7xl">
          One MCP. One card.
          <br />
          Every <span className="text-accent">API</span> your agent needs.
        </h1>

        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted sm:text-xl">
          Install the gateway, sign in once, add a card. Your agent now has
          access to 25+ services — Gmail, Stripe, OpenAI, GitHub, and more —
          without managing a single API key.
        </p>

        <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
          <Link
            href="/docs/agents"
            className="rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light"
          >
            Install
          </Link>
          <Link
            href="/directory"
            className="rounded-lg border border-white/10 px-6 py-3 font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/5"
          >
            Browse the catalog
          </Link>
        </div>
      </div>
    </section>
  );
}

function PillarsSection() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-6 sm:grid-cols-3">
          {/* Plug & play */}
          <div className="rounded-xl border border-white/5 bg-surface-light p-6">
            <span className="font-mono text-sm text-accent">01</span>
            <h3 className="mt-3 text-lg font-semibold">Plug &amp; play</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Install the gateway, run <code className="text-accent">agent-gateway config</code>,
              add it to your MCP client. No per-service setup.
            </p>
            <div className="mt-4 rounded-lg bg-surface p-3">
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
                <code className="text-accent-light">{`$ npm install -g agent-gateway-mcp
$ agent-gateway config
$ # add to Claude/Cursor/etc.`}</code>
              </pre>
            </div>
          </div>

          {/* One card */}
          <div className="rounded-xl border border-white/5 bg-surface-light p-6">
            <span className="font-mono text-sm text-accent">02</span>
            <h3 className="mt-3 text-lg font-semibold">One card</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Pay us, we pay providers. Pay-per-use, billed monthly. No
              per-service subscriptions to manage. Free services stay free.
            </p>
            <div className="mt-4 rounded-lg bg-surface p-3">
              <p className="font-mono text-xs text-muted">
                Invoice — March
              </p>
              <p className="mt-1 font-mono text-xs text-accent-light">
                OpenAI: $4.32
                <br />
                Twilio: $1.10
                <br />
                <span className="text-accent">Total: $5.42</span>
              </p>
            </div>
          </div>

          {/* Lazy by default */}
          <div className="rounded-xl border border-white/5 bg-surface-light p-6">
            <span className="font-mono text-sm text-accent">03</span>
            <h3 className="mt-3 text-lg font-semibold">Lazy by default</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Your agent only sees the services you&apos;ve enabled. No context
              bloat from 242 unused tools. Drill down only when needed.
            </p>
            <div className="mt-4 rounded-lg bg-surface p-3">
              <pre className="overflow-x-auto font-mono text-xs leading-relaxed">
                <code className="text-accent-light">{`> discover()
gmail, stripe, github,
notion, slack (5 enabled)`}</code>
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      number: "01",
      title: "Install",
      description: "One npm install. The gateway is your only MCP server.",
      code: "npm install -g agent-gateway-mcp",
    },
    {
      number: "02",
      title: "Configure",
      description:
        "agent-gateway config opens a local browser page. Sign in, add a card, toggle services on/off.",
      code: "agent-gateway config",
    },
    {
      number: "03",
      title: "Wire it up",
      description: "Add the gateway to your MCP client config (Claude, Cursor, Windsurf, etc.).",
      code: '{ "mcpServers": { "gateway": { "command": "agent-gateway-mcp" } } }',
    },
    {
      number: "04",
      title: "Use",
      description:
        "Talk to your agent. It discovers and calls services through the gateway. No further setup.",
      code: '> "Send an email to Alice about the meeting"',
    },
  ];

  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          How it works
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted">
          Four steps. About two minutes the first time. Zero every other day.
        </p>

        <div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((step) => (
            <div
              key={step.number}
              className="rounded-xl border border-white/5 bg-surface-light p-5"
            >
              <span className="font-mono text-sm text-accent">
                {step.number}
              </span>
              <h3 className="mt-3 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                {step.description}
              </p>
              <div className="mt-4 rounded-lg bg-surface p-3">
                <code className="font-mono text-xs text-accent-light break-all">
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

function AvailableServicesSection() {
  // v1 launch list per docs/pivot-unified-billing.md §5
  const services = [
    "OpenAI",
    "Anthropic",
    "Mistral",
    "Groq",
    "Replicate",
    "Deepgram",
    "Gmail",
    "Slack",
    "Twilio",
    "SendGrid",
    "Resend",
    "Telegram",
    "Google Calendar",
    "Notion",
    "GitHub",
    "Trello",
    "Calendly",
    "Cal.com",
    "Stripe",
    "Cloudflare R2",
    "Mapbox",
    "Algolia",
    "OpenWeatherMap",
    "DeepL",
    "DocSpring",
  ];

  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-5xl px-6">
        <h2 className="text-center text-3xl font-bold sm:text-4xl">
          Available services
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-center text-muted">
          25 services billable through us at launch. 242 in the full catalog —
          enable any of them with your own API key.
        </p>

        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-5">
          {services.map((name) => (
            <div
              key={name}
              className="rounded-lg border border-white/5 bg-surface-light px-3 py-2.5 text-center text-sm text-foreground transition-colors hover:border-accent/20"
            >
              {name}
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/directory"
            className="text-sm text-accent hover:text-accent-light transition-colors"
          >
            See all 242 in the catalog &rarr;
          </Link>
        </div>
      </div>
    </section>
  );
}

function ProvidersSection() {
  return (
    <section className="border-t border-white/5 py-24">
      <div className="mx-auto max-w-3xl px-6 text-center">
        <div className="mb-4 inline-block rounded-full border border-accent/30 bg-accent/10 px-3 py-1 font-mono text-xs text-accent">
          For Service Providers
        </div>
        <h2 className="text-3xl font-bold sm:text-4xl">Run a service?</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted">
          List it on AgentDNS. Implement <code className="text-accent">/.well-known/agent</code>{" "}
          on your domain, submit, and you&apos;re discoverable to every agent
          using the gateway.
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/docs/providers"
            className="rounded-lg border border-white/10 px-5 py-2.5 font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/5"
          >
            Provider docs
          </Link>
          <Link
            href="/submit"
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-black transition-colors hover:bg-accent-light"
          >
            Submit your service
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  return (
    <>
      <HeroSection />
      <PillarsSection />
      <HowItWorksSection />
      <AvailableServicesSection />
      <ProvidersSection />
    </>
  );
}
