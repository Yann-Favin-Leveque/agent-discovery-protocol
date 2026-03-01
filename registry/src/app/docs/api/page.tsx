import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "API Reference — AgentDNS",
  description:
    "Complete REST API reference for the AgentDNS registry. Discover, submit, verify, and validate services.",
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
}: {
  method: string;
  path: string;
  id: string;
}) {
  const methodColors: Record<string, string> = {
    GET: "bg-blue-500/10 text-blue-400",
    POST: "bg-green-500/10 text-green-400",
    PUT: "bg-yellow-500/10 text-yellow-400",
    DELETE: "bg-red-500/10 text-red-400",
  };

  return (
    <div id={id} className="flex items-center gap-3 scroll-mt-24 group">
      <span
        className={`rounded-md px-2 py-0.5 font-mono text-xs font-bold ${methodColors[method] ?? "bg-white/10 text-white"}`}
      >
        {method}
      </span>
      <code className="font-mono text-lg font-semibold">{path}</code>
      <a href={`#${id}`} className="text-accent opacity-0 group-hover:opacity-100 transition-opacity">
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

      <h1 className="mt-6 text-4xl font-bold">API Reference</h1>
      <p className="mt-4 text-lg text-muted">
        The AgentDNS registry REST API. Base URL:{" "}
        <code className="text-accent">https://agent-dns.dev</code>
      </p>

      {/* TOC */}
      <nav className="mt-8 rounded-xl border border-white/5 bg-surface-light p-6">
        <h2 className="font-semibold text-sm mb-3">Endpoints</h2>
        <ul className="space-y-1.5 text-sm">
          <li>
            <a href="#discover" className="text-muted hover:text-accent transition-colors">
              <span className="inline-block w-12 font-mono text-blue-400">GET</span>
              /api/discover
            </a>
          </li>
          <li>
            <a href="#list-services" className="text-muted hover:text-accent transition-colors">
              <span className="inline-block w-12 font-mono text-blue-400">GET</span>
              /api/services
            </a>
          </li>
          <li>
            <a href="#submit-service" className="text-muted hover:text-accent transition-colors">
              <span className="inline-block w-12 font-mono text-green-400">POST</span>
              /api/services
            </a>
          </li>
          <li>
            <a href="#get-service" className="text-muted hover:text-accent transition-colors">
              <span className="inline-block w-12 font-mono text-blue-400">GET</span>
              /api/services/:domain
            </a>
          </li>
          <li>
            <a href="#get-capability-detail" className="text-muted hover:text-accent transition-colors">
              <span className="inline-block w-12 font-mono text-blue-400">GET</span>
              /api/services/:domain/capabilities/:name
            </a>
          </li>
          <li>
            <a href="#verify" className="text-muted hover:text-accent transition-colors">
              <span className="inline-block w-12 font-mono text-green-400">POST</span>
              /api/verify/:domain
            </a>
          </li>
          <li>
            <a href="#validate" className="text-muted hover:text-accent transition-colors">
              <span className="inline-block w-12 font-mono text-green-400">POST</span>
              /api/validate
            </a>
          </li>
        </ul>
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
      ],
    }
  ]
}`}</CodeBlock>
        </div>
      </section>

      {/* GET /api/services */}
      <section className="mt-16">
        <EndpointHeader
          method="GET"
          path="/api/services"
          id="list-services"
        />
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

        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "success": true,
  "data": [
    {
      "name": "MailForge",
      "domain": "api.mailforge.dev",
      "description": "Transactional email API",
      "base_url": "https://api.mailforge.dev",
      "auth_type": "api_key",
      "pricing_type": "freemium",
      "verified": true,
      "capability_count": 3,
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": { "total": 42, "limit": 50, "offset": 0 }
}`}</CodeBlock>
        </div>
      </section>

      {/* POST /api/services */}
      <section className="mt-16">
        <EndpointHeader
          method="POST"
          path="/api/services"
          id="submit-service"
        />
        <p className="mt-4 text-muted">
          Submit a new service. Two modes: auto-discover by domain, or manual
          manifest paste.
        </p>

        <h3 className="mt-6 font-semibold">Mode 1: Auto-discover</h3>
        <div className="mt-2">
          <CodeBlock title="Request">{`POST /api/services
Content-Type: application/json

{
  "domain": "api.example.com"
}`}</CodeBlock>
        </div>
        <p className="mt-2 text-sm text-muted">
          The registry will crawl{" "}
          <code className="text-accent">
            https://api.example.com/.well-known/agent
          </code>
          , validate the manifest, and register the service.
        </p>

        <h3 className="mt-6 font-semibold">Mode 2: Manual manifest</h3>
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

        <div className="mt-4">
          <CodeBlock title="Response (201)">{`{
  "success": true,
  "data": {
    "domain": "api.example.com",
    "name": "My API",
    "verified": true,
    "detail_url_ok": true,
    "response_time_ms": 142,
    "message": "Service discovered and registered successfully."
  }
}`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="Error Response (422)">{`{
  "success": false,
  "errors": [
    "Missing required field: spec_version",
    "Description must be 10-200 characters"
  ]
}`}</CodeBlock>
        </div>
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
        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "success": true,
  "data": {
    "name": "MailForge",
    "domain": "api.mailforge.dev",
    "description": "Transactional email API",
    "base_url": "https://api.mailforge.dev",
    "auth_type": "api_key",
    "pricing_type": "freemium",
    "verified": true,
    "capabilities": [
      {
        "name": "send_email",
        "description": "Send a transactional email",
        "detail_url": "/api/capabilities/send_email"
      }
    ],
    "created_at": "2024-01-15T10:30:00Z",
    "last_crawled_at": "2024-01-20T08:00:00Z"
  }
}`}</CodeBlock>
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
          Returns the full capability detail JSON for a specific capability on a service.
          This includes the endpoint path, HTTP method, parameters, request/response examples,
          required auth scopes, and rate limits. Used as a fallback when the service does not
          implement its own capability detail endpoints.
        </p>

        <div className="mt-4">
          <CodeBlock title="Request">{`GET /api/services/gmail.googleapis.com/capabilities/users_messages`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "name": "users_messages",
  "description": "Manage users messages — send, list, modify labels...",
  "endpoint": "/gmail/v1/users/{userId}/messages",
  "method": "GET",
  "parameters": [
    {
      "name": "userId",
      "type": "string",
      "description": "The user's email address. Use 'me' for the authenticated user.",
      "required": true,
      "example": "me"
    }
  ],
  "request_example": {
    "method": "GET",
    "url": "https://gmail.googleapis.com/gmail/v1/users/me/messages",
    "headers": {
      "Authorization": "Bearer {access_token}"
    }
  },
  "response_example": {
    "status": 200,
    "body": { "messages": [...], "nextPageToken": "..." }
  },
  "auth_scopes": ["https://www.googleapis.com/auth/gmail.readonly"]
}`}</CodeBlock>
        </div>
      </section>

      {/* POST /api/verify/:domain */}
      <section className="mt-16">
        <EndpointHeader
          method="POST"
          path="/api/verify/:domain"
          id="verify"
        />
        <p className="mt-4 text-muted">
          Re-crawl a registered service and update its verification status.
          Checks that the manifest is valid and at least one detail_url resolves.
        </p>

        <div className="mt-4">
          <CodeBlock title="Request">{`POST /api/verify/api.mailforge.dev`}</CodeBlock>
        </div>
        <div className="mt-4">
          <CodeBlock title="Response (200)">{`{
  "success": true,
  "data": {
    "domain": "api.mailforge.dev",
    "verified": true,
    "detail_url_ok": true,
    "response_time_ms": 89,
    "message": "Service verified successfully. Manifest updated from live endpoint."
  }
}`}</CodeBlock>
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
          <CodeBlock title="Request">{`POST /api/validate
Content-Type: application/json

{
  "spec_version": "1.0",
  "name": "My API",
  "description": "Test manifest",
  "base_url": "https://api.example.com",
  "auth": { "type": "none" },
  "capabilities": [
    {
      "name": "test_cap",
      "description": "A test capability",
      "detail_url": "/api/capabilities/test"
    }
  ]
}`}</CodeBlock>
        </div>
        <div className="mt-4">
          <CodeBlock title="Response (200) — Valid">{`{
  "valid": true,
  "errors": []
}`}</CodeBlock>
        </div>
        <div className="mt-4">
          <CodeBlock title="Response (200) — Invalid">{`{
  "valid": false,
  "errors": [
    { "path": "$.description", "message": "Description must be 10-200 characters" },
    { "path": "$.capabilities[0].name", "message": "Capability name must be snake_case" }
  ]
}`}</CodeBlock>
        </div>
      </section>

      {/* Response format */}
      <section className="mt-16 rounded-xl border border-white/5 bg-surface-light p-8">
        <h2 className="text-xl font-bold">Response Format</h2>
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
// 400 — Bad request (missing/invalid params)
// 404 — Not found
// 409 — Conflict (already exists)
// 422 — Validation failed
// 500 — Server error`}</CodeBlock>
        </div>
      </section>
    </div>
  );
}
