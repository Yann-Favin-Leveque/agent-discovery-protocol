import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Spec Reference — AgentDNS",
  description:
    "The complete Agent Discovery Protocol v1.0 specification. Endpoint format, manifest schema, capability detail schema, and discovery flow.",
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

function AnchorHeading({
  id,
  level,
  children,
}: {
  id: string;
  level: 2 | 3;
  children: React.ReactNode;
}) {
  const Tag = level === 2 ? "h2" : "h3";
  const size = level === 2 ? "text-2xl" : "text-xl";
  return (
    <Tag id={id} className={`${size} font-bold scroll-mt-24 group`}>
      <a href={`#${id}`} className="hover:text-accent transition-colors">
        {children}
        <span className="ml-2 opacity-0 group-hover:opacity-100 text-accent transition-opacity">
          #
        </span>
      </a>
    </Tag>
  );
}

export default function SpecPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/docs"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Docs
      </Link>

      <h1 className="mt-6 text-4xl font-bold">
        Agent Discovery Protocol v1.0
      </h1>
      <p className="mt-4 text-lg text-muted">
        A simple web standard for making APIs discoverable by AI agents. One
        endpoint. One JSON format. That&apos;s the whole spec.
      </p>

      {/* Table of Contents */}
      <nav className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
        <h2 className="font-semibold text-sm mb-3">Contents</h2>
        <ul className="space-y-1.5 text-sm">
          <li>
            <a href="#endpoint" className="text-muted hover:text-accent transition-colors">
              1. Endpoint
            </a>
          </li>
          <li>
            <a href="#manifest" className="text-muted hover:text-accent transition-colors">
              2. Manifest Format
            </a>
          </li>
          <li>
            <a href="#auth" className="text-muted hover:text-accent transition-colors">
              3. Auth Object
            </a>
          </li>
          <li>
            <a href="#pricing" className="text-muted hover:text-accent transition-colors">
              4. Pricing Object
            </a>
          </li>
          <li>
            <a href="#capability-detail" className="text-muted hover:text-accent transition-colors">
              5. Capability Detail Format
            </a>
          </li>
          <li>
            <a href="#discovery-flow" className="text-muted hover:text-accent transition-colors">
              6. Discovery Flow
            </a>
          </li>
          <li>
            <a href="#requirements" className="text-muted hover:text-accent transition-colors">
              7. Requirements
            </a>
          </li>
        </ul>
      </nav>

      {/* 1. Endpoint */}
      <section className="mt-16">
        <AnchorHeading id="endpoint" level={2}>
          1. Endpoint
        </AnchorHeading>
        <p className="mt-4 text-muted">
          Every service implementing the protocol MUST serve a JSON manifest at:
        </p>
        <div className="mt-4">
          <CodeBlock>{`GET https://{domain}/.well-known/agent`}</CodeBlock>
        </div>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li>
            <strong className="text-foreground">Path:</strong>{" "}
            <code className="text-accent">/.well-known/agent</code> (following{" "}
            <a
              href="https://www.rfc-editor.org/rfc/rfc8615"
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              RFC 8615
            </a>
            )
          </li>
          <li>
            <strong className="text-foreground">Method:</strong> GET
          </li>
          <li>
            <strong className="text-foreground">Content-Type:</strong>{" "}
            <code className="text-accent">application/json</code>
          </li>
          <li>
            <strong className="text-foreground">CORS:</strong> Recommended for
            public APIs
          </li>
          <li>
            <strong className="text-foreground">Cache:</strong>{" "}
            <code className="text-accent">Cache-Control: max-age=3600</code>{" "}
            recommended
          </li>
        </ul>
      </section>

      {/* 2. Manifest */}
      <section className="mt-16">
        <AnchorHeading id="manifest" level={2}>
          2. Manifest Format
        </AnchorHeading>

        <div className="mt-4 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 pr-4 font-semibold">Required</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">spec_version</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 pr-4 text-muted">Yes</td>
                <td className="py-2 text-muted">Protocol version. Currently &quot;1.0&quot;</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">name</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 pr-4 text-muted">Yes</td>
                <td className="py-2 text-muted">Human-readable service name</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">description</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 pr-4 text-muted">Yes</td>
                <td className="py-2 text-muted">10-200 chars. What the service does</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">base_url</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 pr-4 text-muted">Yes</td>
                <td className="py-2 text-muted">Base URL for relative detail_urls</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">auth</td>
                <td className="py-2 pr-4 text-muted">object</td>
                <td className="py-2 pr-4 text-muted">Yes</td>
                <td className="py-2 text-muted">Authentication requirements</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">pricing</td>
                <td className="py-2 pr-4 text-muted">object</td>
                <td className="py-2 pr-4 text-muted">No</td>
                <td className="py-2 text-muted">Pricing model and plans</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">capabilities</td>
                <td className="py-2 pr-4 text-muted">array</td>
                <td className="py-2 pr-4 text-muted">Yes</td>
                <td className="py-2 text-muted">List of capabilities (min 1)</td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-6">
          <AnchorHeading id="manifest-capability" level={3}>
            Capability entry
          </AnchorHeading>
          <div className="mt-4 rounded-xl border border-white/5 bg-surface-light p-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-left">
                  <th className="pb-2 pr-4 font-semibold">Field</th>
                  <th className="pb-2 pr-4 font-semibold">Type</th>
                  <th className="pb-2 font-semibold">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                <tr>
                  <td className="py-2 pr-4 font-mono text-accent">name</td>
                  <td className="py-2 pr-4 text-muted">string</td>
                  <td className="py-2 text-muted">snake_case identifier</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-accent">description</td>
                  <td className="py-2 pr-4 text-muted">string</td>
                  <td className="py-2 text-muted">What this capability does</td>
                </tr>
                <tr>
                  <td className="py-2 pr-4 font-mono text-accent">detail_url</td>
                  <td className="py-2 pr-4 text-muted">string</td>
                  <td className="py-2 text-muted">URL for full details (absolute or relative to base_url)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-6">
          <CodeBlock title="Full manifest example">{`{
  "spec_version": "1.0",
  "name": "MailForge",
  "description": "Transactional email API with templates and analytics.",
  "base_url": "https://api.mailforge.dev",
  "auth": {
    "type": "api_key",
    "header": "X-Api-Key",
    "setup_url": "https://mailforge.dev/dashboard/api-keys"
  },
  "pricing": {
    "type": "freemium",
    "plans": [
      { "name": "Free", "price": "$0/mo", "limits": "100 emails/day" },
      { "name": "Pro", "price": "$29/mo", "limits": "10,000 emails/day" }
    ]
  },
  "capabilities": [
    {
      "name": "send_email",
      "description": "Send a transactional email with optional template",
      "detail_url": "/api/capabilities/send_email"
    },
    {
      "name": "get_analytics",
      "description": "Get email delivery analytics and open rates",
      "detail_url": "/api/capabilities/get_analytics"
    }
  ]
}`}</CodeBlock>
        </div>
      </section>

      {/* 3. Auth */}
      <section className="mt-16">
        <AnchorHeading id="auth" level={2}>
          3. Auth Object
        </AnchorHeading>
        <div className="mt-4 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">type</td>
                <td className="py-2 text-muted">&quot;none&quot; | &quot;api_key&quot; | &quot;oauth2&quot;</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">header</td>
                <td className="py-2 text-muted">Header name for api_key (default: &quot;Authorization&quot;)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">prefix</td>
                <td className="py-2 text-muted">Prefix for api_key (default: &quot;Bearer&quot;)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">setup_url</td>
                <td className="py-2 text-muted">URL where users can get API keys</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">authorization_url</td>
                <td className="py-2 text-muted">OAuth2 authorization endpoint</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">token_url</td>
                <td className="py-2 text-muted">OAuth2 token endpoint</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">scopes</td>
                <td className="py-2 text-muted">OAuth2 scopes (string array)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 4. Pricing */}
      <section className="mt-16">
        <AnchorHeading id="pricing" level={2}>
          4. Pricing Object
        </AnchorHeading>
        <div className="mt-4 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">type</td>
                <td className="py-2 text-muted">&quot;free&quot; | &quot;freemium&quot; | &quot;paid&quot;</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">plans</td>
                <td className="py-2 text-muted">Array of {`{ name, price, limits }`}</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">plans_url</td>
                <td className="py-2 text-muted">URL to full pricing page</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5. Capability Detail */}
      <section className="mt-16">
        <AnchorHeading id="capability-detail" level={2}>
          5. Capability Detail Format
        </AnchorHeading>
        <p className="mt-4 text-muted">
          Each capability&apos;s <code className="text-accent">detail_url</code>{" "}
          returns a JSON object with everything an agent needs to call it:
        </p>

        <div className="mt-4 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left">
                <th className="pb-2 pr-4 font-semibold">Field</th>
                <th className="pb-2 pr-4 font-semibold">Type</th>
                <th className="pb-2 font-semibold">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">name</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 text-muted">Capability identifier</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">description</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 text-muted">Detailed description</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">endpoint</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 text-muted">API endpoint path or full URL</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">method</td>
                <td className="py-2 pr-4 text-muted">string</td>
                <td className="py-2 text-muted">HTTP method (GET, POST, etc.)</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">parameters</td>
                <td className="py-2 pr-4 text-muted">array</td>
                <td className="py-2 text-muted">Parameter definitions with name, type, description, required, example</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">request_example</td>
                <td className="py-2 pr-4 text-muted">object</td>
                <td className="py-2 text-muted">Full example HTTP request</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">response_example</td>
                <td className="py-2 pr-4 text-muted">object</td>
                <td className="py-2 text-muted">Example response with status and body</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">auth_scopes</td>
                <td className="py-2 pr-4 text-muted">string[]?</td>
                <td className="py-2 text-muted">Required OAuth2 scopes</td>
              </tr>
              <tr>
                <td className="py-2 pr-4 font-mono text-accent">rate_limits</td>
                <td className="py-2 pr-4 text-muted">object?</td>
                <td className="py-2 text-muted">requests_per_minute, daily_limit</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 6. Discovery Flow */}
      <section className="mt-16">
        <AnchorHeading id="discovery-flow" level={2}>
          6. Discovery Flow
        </AnchorHeading>
        <p className="mt-4 text-muted">
          The protocol uses lazy drill-down. Agents fetch only what they need,
          when they need it:
        </p>

        <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-6 font-mono text-sm leading-relaxed text-muted">
          <div className="space-y-3">
            <p>
              <span className="text-accent">1.</span> Agent asks: &quot;I need to send an email&quot;
            </p>
            <p>
              <span className="text-accent">2.</span> Registry search:{" "}
              <code className="text-accent-light">GET /api/discover?q=send+email</code>
            </p>
            <p className="pl-5">
              Returns: service names, domains, matching capability summaries
            </p>
            <p>
              <span className="text-accent">3.</span> Agent picks a service, fetches manifest:{" "}
              <code className="text-accent-light">
                GET https://api.mailforge.dev/.well-known/agent
              </code>
            </p>
            <p className="pl-5">
              Returns: full capability list, auth requirements, pricing
            </p>
            <p>
              <span className="text-accent">4.</span> Agent drills into the capability it needs:{" "}
              <code className="text-accent-light">
                GET /api/capabilities/send_email
              </code>
            </p>
            <p className="pl-5">
              Returns: endpoint, method, parameters, examples
            </p>
            <p>
              <span className="text-accent">5.</span> Agent calls the capability with the right parameters
            </p>
          </div>
        </div>
      </section>

      {/* 7. Requirements */}
      <section className="mt-16">
        <AnchorHeading id="requirements" level={2}>
          7. Requirements
        </AnchorHeading>
        <ul className="mt-4 space-y-3 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>Manifest MUST be served at <code className="text-accent">/.well-known/agent</code></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>Response MUST be valid JSON with <code className="text-accent">Content-Type: application/json</code></span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span><code className="text-accent">spec_version</code> MUST be &quot;1.0&quot;</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span><code className="text-accent">description</code> MUST be 10-200 characters</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>Capability names MUST be snake_case</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>At least one capability MUST be defined</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>Each capability MUST have a <code className="text-accent">detail_url</code> that returns valid JSON</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span>Capability names MUST be unique within a manifest</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#8226;</span>
            <span><code className="text-accent">base_url</code> MUST start with <code className="text-accent">https://</code></span>
          </li>
        </ul>
      </section>

      {/* Link to full spec */}
      <div className="mt-16 rounded-xl border border-white/5 bg-surface-light p-6 text-center">
        <p className="text-muted text-sm">
          Full specification with additional examples available on GitHub:
        </p>
        <a
          href="https://github.com/Yann-Favin-Leveque/agent-discovery-protocol/tree/main/spec"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-block text-accent hover:underline"
        >
          View spec on GitHub &rarr;
        </a>
      </div>
    </div>
  );
}
