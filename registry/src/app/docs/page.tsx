import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — AgentDNS",
  description:
    "Learn how to implement the Agent Discovery Protocol. Guides for service providers, agent developers, and full API reference.",
};

const sections = [
  {
    title: "For Service Providers",
    href: "/docs/providers",
    description:
      "Make your API agent-ready in 10 minutes. Add one endpoint, become discoverable by every AI agent.",
    tag: "Guide",
  },
  {
    title: "For Agent Developers",
    href: "/docs/agents",
    description:
      "Give your agent access to every API. Use the Gateway MCP, query the registry, or fetch manifests directly.",
    tag: "Guide",
  },
  {
    title: "Spec Reference",
    href: "/docs/spec",
    description:
      "The full Agent Discovery Protocol specification. Manifest format, capability details, endpoint rules.",
    tag: "Reference",
  },
  {
    title: "API Reference",
    href: "/docs/api",
    description:
      "Registry REST API. Discover services, submit, verify, validate — with request/response examples.",
    tag: "Reference",
  },
  {
    title: "Security",
    href: "/docs/security",
    description:
      "Trust levels, rate limits, domain protection, and how to report abusive services.",
    tag: "Security",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-24">
      <h1 className="text-4xl font-bold">Documentation</h1>
      <p className="mt-4 text-lg text-muted">
        Everything you need to implement the Agent Discovery Protocol — whether
        you&apos;re a service provider, an agent developer, or building on the
        registry API.
      </p>

      <div className="mt-12 grid gap-6 sm:grid-cols-2">
        {sections.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-xl border border-white/5 bg-surface-light p-6 transition-colors hover:border-accent/30 hover:bg-surface-lighter"
          >
            <div className="mb-3 inline-block rounded-md bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
              {section.tag}
            </div>
            <h2 className="text-lg font-semibold group-hover:text-accent transition-colors">
              {section.title}
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              {section.description}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}
