import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference — AgentDNS",
  description:
    "Complete REST API reference for the AgentDNS registry: discovery, services, validation, and authenticated user enablement / billing.",
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

function EndpointHeader({
  method,
  path,
  id,
  auth,
}: {
  method: string;
  path: string;
  id: string;
  auth?: boolean;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/10 text-blue-400",
    POST: "bg-green-500/10 text-green-400",
    PUT: "bg-yellow-500/10 text-yellow-400",
    DELETE: "bg-red-500/10 text-red-400",
  };

  return (
    <div id={id} className="flex flex-wrap items-center gap-3 scroll-mt-24 group">
      <span
        className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${methodColors[method] ?? "bg-white/10 text-white"}`}
      >
        {method}
      </span>
      <code className="font-mono text-lg font-semibold">{path}</code>
      {auth && (
        <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 font-mono text-xs text-yellow-400">
          auth required
        </span>
      )}
      <a
        href={`#${id}`}
        className="text-accent opacity-0 group-hover:opacity-100 transition-opacity"
      >
        #
      </a>
    </div>
  );
}

export default function ApiPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/docs"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Docs
      </Link>

      <h1 className="mt-6 text-4xl font-bold">Registry API</h1>
      <p className="mt-4 text-lg text-muted">
        REST API for the AgentDNS registry. Base URL:{" "}
        <code className="text-accent">https://agent-dns.dev</code>.
      </p>

      {/* Auth note */}
      <div className="mt-8 rounded-xl border border-white/5 bg-surface-light p-5 text-sm text-muted">
        <p>
          <strong className="text-foreground">Authentication.</strong>{" "}
          Public endpoints (discover, services, validate, reports) require no
          auth. Endpoints under{" "}
          <code className="text-accent">/api/users/me/*</code> and{" "}
          <code className="text-accent">/api/users/payment-method</code> require
          a Bearer JWT obtained from the gateway sign-in flow (or an active
          browser session if you call them from a logged-in tab).
        </p>
        <p className="mt-3">
          Set the header{" "}
          <code className="text-accent">
            Authorization: Bearer {"<registry_token>"}
          </code>{" "}
          on every authenticated request.
        </p>
      </div>

      {/* TOC */}
      <nav className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
        <h2 className="font-semibold text-sm mb-3">Endpoints</h2>
        <div className="grid gap-1.5 text-sm sm:grid-cols-2">
          <a href="#discover" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-blue-400">GET</span>
            /api/discover
          </a>
          <a href="#list-services" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-blue-400">GET</span>
            /api/services
          </a>
          <a href="#submit-service" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-green-400">POST</span>
            /api/services
          </a>
          <a href="#get-service" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-blue-400">GET</span>
            /api/services/:domain
          </a>
          <a href="#get-capability-detail" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-blue-400">GET</span>
            /api/services/:domain/capabilities/:name
          </a>
          <a href="#validate" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-green-400">POST</span>
            /api/validate
          </a>
          <a href="#reports" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-green-400">POST</span>
            /api/reports
          </a>
          <a href="#stripe-key" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-blue-400">GET</span>
            /api/config/stripe-publishable-key
          </a>
          <a href="#enablement-list" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-blue-400">GET</span>
            /api/users/me/enablement
          </a>
          <a href="#enablement-upsert" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-green-400">POST</span>
            /api/users/me/enablement
          </a>
          <a href="#enablement-delete" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-red-400">DEL</span>
            /api/users/me/enablement/:domain
          </a>
          <a href="#billing-portal" className="text-muted hover:text-accent transition-colors">
            <span className="inline-block w-12 font-mono text-green-400">POST</span>
            /api/users/me/billing-portal
          </a>
        </div>
      </nav>

      {/* GET /api/discover */}
      <section className="mt-16">
        <EndpointHeader method="GET" path="/api/discover" id="discover" />
        <p className="mt-4 text-muted">
          Search for services by intent. Returns matching services ranked by
          relevance, with capability matches highlighted.
        </p>

        <h3 className="mt-6 font-semibold">Query Parameters</h3>
        <div className="mt-2 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <tbody>
              <tr>
                <td className="py-1.5 pr-4 font-mono text-accent">q</td>
                <td className="py-1.5 pr-4 text-muted">string</td>
                <td className="py-1.5 text-muted">
                  Required. Natural language search query.
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-4">
          <CodeBlock title="Request">{`GET /api/discover?q=send+email`}</CodeBlock>
        </div>
        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "success": true,
  "query": "send email",
  "result_count": 2,
  "data": [
    {
      "service": {
        "name": "MailForge",
        "domain": "api.mailforge.dev",
        "description": "Transactional email API",
        "base_url": "https://api.mailforge.dev",
        "auth_type": "api_key",
        "pricing_type": "freemium",
        "verified": true
      },
      "matching_capabilities": [
        {
          "name": "send_email",
          "description": "Send a transactional email",
          "detail_url": "https://api.mailforge.dev/api/capabilities/send_email"
        }
      ]
    }
  ]
}`}</CodeBlock>
        </div>
      </section>

      {/* GET /api/services */}
      <section className="mt-16">
        <EndpointHeader method="GET" path="/api/services" id="list-services" />
        <p className="mt-4 text-muted">
          List all registered services with pagination, filtering, and sorting.
        </p>

        <h3 className="mt-6 font-semibold">Query Parameters</h3>
        <div className="mt-2 rounded-xl border border-white/5 bg-surface-light p-4">
          <table className="w-full text-sm">
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-1.5 pr-4 font-mono text-accent">category</td>
                <td className="py-1.5 pr-4 text-muted">string?</td>
                <td className="py-1.5 text-muted">Filter by category slug</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-mono text-accent">search</td>
                <td className="py-1.5 pr-4 text-muted">string?</td>
                <td className="py-1.5 text-muted">Text search in name/description</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-mono text-accent">sort</td>
                <td className="py-1.5 pr-4 text-muted">string?</td>
                <td className="py-1.5 text-muted">&quot;newest&quot; | &quot;name&quot; | &quot;capabilities&quot;</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-mono text-accent">limit</td>
                <td className="py-1.5 pr-4 text-muted">number?</td>
                <td className="py-1.5 text-muted">Max 100, default 50</td>
              </tr>
              <tr>
                <td className="py-1.5 pr-4 font-mono text-accent">offset</td>
                <td className="py-1.5 pr-4 text-muted">number?</td>
                <td className="py-1.5 text-muted">Pagination offset, default 0</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* POST /api/services */}
      <section className="mt-16">
        <EndpointHeader method="POST" path="/api/services" id="submit-service" />
        <p className="mt-4 text-muted">
          Submit a new service. Two modes: auto-discover by domain, or manual
          manifest paste.
        </p>

        <h3 className="mt-6 font-semibold">Mode 1: auto-discover</h3>
        <div className="mt-2">
          <CodeBlock title="Request">{`POST /api/services
Content-Type: application/json

{
  "domain": "api.example.com"
}`}</CodeBlock>
        </div>
        <p className="mt-2 text-sm text-muted">
          The registry crawls{" "}
          <code className="text-accent">
            https://api.example.com/.well-known/agent
          </code>
          , validates, and registers the service as verified.
        </p>

        <h3 className="mt-6 font-semibold">Mode 2: manual manifest</h3>
        <div className="mt-2">
          <CodeBlock title="Request">{`POST /api/services
Content-Type: application/json

{
  "manifest": {
    "spec_version": "1.0",
    "name": "My API",
    "description": "...",
    "base_url": "https://api.example.com",
    "auth": { "type": "none" },
    "capabilities": [ ... ]
  }
}`}</CodeBlock>
        </div>
        <p className="mt-2 text-sm text-muted">
          Registers as unverified until the live{" "}
          <code className="text-accent">/.well-known/agent</code> endpoint
          becomes reachable.
        </p>
      </section>

      {/* GET /api/services/:domain */}
      <section className="mt-16">
        <EndpointHeader
          method="GET"
          path="/api/services/:domain"
          id="get-service"
        />
        <p className="mt-4 text-muted">
          Get detailed information about a specific registered service,
          including all capabilities.
        </p>
        <div className="mt-4">
          <CodeBlock title="Request">{`GET /api/services/api.mailforge.dev`}</CodeBlock>
        </div>
      </section>

      {/* GET /api/services/:domain/capabilities/:name */}
      <section className="mt-16">
        <EndpointHeader
          method="GET"
          path="/api/services/:domain/capabilities/:name"
          id="get-capability-detail"
        />
        <p className="mt-4 text-muted">
          Returns the full capability detail JSON: endpoint, method,
          parameters, request/response examples, auth scopes, rate limits.
          Used as a fallback when the service does not implement its own
          capability detail endpoints.
        </p>

        <div className="mt-4">
          <CodeBlock title="Request">{`GET /api/services/gmail.googleapis.com/capabilities/users_messages`}</CodeBlock>
        </div>
      </section>

      {/* POST /api/validate */}
      <section className="mt-16">
        <EndpointHeader method="POST" path="/api/validate" id="validate" />
        <p className="mt-4 text-muted">
          Validate a manifest without registering it. Useful for testing before
          submission.
        </p>
        <div className="mt-4">
          <CodeBlock title="Response (200) — Valid">{`{
  "valid": true,
  "errors": []
}`}</CodeBlock>
        </div>
      </section>

      {/* POST /api/reports */}
      <section className="mt-16">
        <EndpointHeader method="POST" path="/api/reports" id="reports" />
        <p className="mt-4 text-muted">
          Report a service for abuse, policy violation, or suspected
          impersonation. Reviewed by the AgentDNS team.
        </p>
        <div className="mt-4">
          <CodeBlock title="Request">{`POST /api/reports
Content-Type: application/json

{
  "domain": "suspicious-service.com",
  "reason": "Phishing — impersonating a legitimate service"
}`}</CodeBlock>
        </div>
      </section>

      {/* GET /api/config/stripe-publishable-key */}
      <section className="mt-16">
        <EndpointHeader
          method="GET"
          path="/api/config/stripe-publishable-key"
          id="stripe-key"
        />
        <p className="mt-4 text-muted">
          Returns the Stripe publishable key the local{" "}
          <code className="text-accent">agent-gateway config</code> page needs
          to mount Stripe Elements. Returns{" "}
          <code className="text-accent">publishable_key: null</code> if Stripe
          is not configured server-side, so the page can render gracefully.
        </p>
        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "success": true,
  "data": { "publishable_key": "pk_live_..." }
}`}</CodeBlock>
        </div>
      </section>

      {/* GET /api/users/me/enablement */}
      <section className="mt-16">
        <EndpointHeader
          method="GET"
          path="/api/users/me/enablement"
          id="enablement-list"
          auth
        />
        <p className="mt-4 text-muted">
          List all services the signed-in user has toggled. Each entry includes
          enabled state, monthly spending cap, and whether a BYO credential
          blob is present.
        </p>
        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "success": true,
  "data": [
    {
      "user_id": 42,
      "service_id": 7,
      "domain": "api.openai.com",
      "name": "OpenAI",
      "enabled": true,
      "monthly_cap_cents": 1000,
      "has_byo_credentials": false,
      "enabled_at": "2026-04-01T10:30:00Z"
    }
  ]
}`}</CodeBlock>
        </div>
      </section>

      {/* POST /api/users/me/enablement */}
      <section className="mt-16">
        <EndpointHeader
          method="POST"
          path="/api/users/me/enablement"
          id="enablement-upsert"
          auth
        />
        <p className="mt-4 text-muted">
          Upsert a per-service enablement row for the signed-in user. Either
          <code className="text-accent">{" service_id "}</code>or{" "}
          <code className="text-accent">domain</code> identifies the service.
          <code className="text-accent">{" byo_credential_blob "}</code>is a
          base64-encoded blob (set to <code className="text-accent">null</code>{" "}
          to clear it; omit to leave untouched).
        </p>
        <div className="mt-4">
          <CodeBlock title="Request">{`POST /api/users/me/enablement
Content-Type: application/json
Authorization: Bearer <registry_token>

{
  "domain": "api.openai.com",
  "enabled": true,
  "monthly_cap_cents": 2000
}`}</CodeBlock>
        </div>
      </section>

      {/* DELETE /api/users/me/enablement/:domain */}
      <section className="mt-16">
        <EndpointHeader
          method="DELETE"
          path="/api/users/me/enablement/:domain"
          id="enablement-delete"
          auth
        />
        <p className="mt-4 text-muted">
          Soft-delete the enablement (sets{" "}
          <code className="text-accent">enabled=false</code>). The row is kept
          so monthly cap and BYO credentials persist if the user re-enables
          later.
        </p>
      </section>

      {/* POST /api/users/me/billing-portal */}
      <section className="mt-16">
        <EndpointHeader
          method="POST"
          path="/api/users/me/billing-portal"
          id="billing-portal"
          auth
        />
        <p className="mt-4 text-muted">
          Returns a Stripe Customer Portal session URL. The signed-in user
          opens this URL to manage payment methods, view invoices, and
          download receipts. Requires the user has already added a card
          (i.e. <code className="text-accent">stripe_customer_id</code> is
          set).
        </p>
        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "success": true,
  "data": { "url": "https://billing.stripe.com/p/session/..." }
}`}</CodeBlock>
        </div>
      </section>

      {/* Response format */}
      <section className="mt-16 rounded-xl border border-white/5 bg-surface-light p-8">
        <h2 className="text-xl font-bold">Response format</h2>
        <p className="mt-4 text-sm text-muted">
          All API responses follow a consistent format:
        </p>
        <div className="mt-4">
          <CodeBlock>{`// Success
{ "success": true, "data": { ... } }

// Error
{ "success": false, "error": "Description of what went wrong" }

// Validation error
{ "success": false, "errors": ["error1", "error2"] }

// HTTP status codes:
// 200 — Success
// 201 — Created
// 400 — Bad request
// 401 — Not authenticated
// 403 — Blocked / forbidden
// 404 — Not found
// 409 — Conflict (already exists)
// 422 — Validation failed
// 429 — Rate limited
// 500 — Server error`}</CodeBlock>
        </div>
      </section>
    </div>
  );
}
