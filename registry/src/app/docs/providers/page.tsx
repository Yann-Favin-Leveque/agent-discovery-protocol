import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "For Service Providers — AgentDNS",
  description:
    "Make your API agent-ready in 10 minutes. Add one JSON endpoint and your API becomes discoverable by every AI agent.",
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

      <h1 className="mt-6 text-4xl font-bold">
        Make your API agent-ready in 10 minutes
      </h1>
      <p className="mt-4 text-lg text-muted">
        Add a single JSON endpoint. Your API becomes discoverable by every AI
        agent. No SDK to maintain, no MCP server to build, no partnership to
        negotiate.
      </p>

      {/* Step 1 */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
            1
          </span>
          <h2 className="text-2xl font-bold">Create your manifest</h2>
        </div>
        <p className="mt-4 text-muted">
          A manifest is a JSON file that describes your API&apos;s capabilities
          in both human-readable and machine-readable format. Here&apos;s the
          minimal version:
        </p>

        <div className="mt-6">
          <CodeBlock title="Minimal manifest">{`{
  "spec_version": "1.0",
  "name": "My API",
  "description": "What my API does in one sentence.",
  "base_url": "https://api.example.com",
  "auth": {
    "type": "none"
  },
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
          Each capability points to a <code className="text-accent">detail_url</code> —
          a deeper JSON endpoint that describes exactly how to call it (method,
          parameters, examples). Agents only fetch these when they need them
          (lazy drill-down).
        </p>

        <div className="mt-6">
          <CodeBlock title="Capability detail (at /api/capabilities/get_data)">{`{
  "name": "get_data",
  "description": "Fetch data by ID",
  "endpoint": "/v1/data/{id}",
  "method": "GET",
  "parameters": [
    {
      "name": "id",
      "type": "string",
      "description": "The data ID to fetch",
      "required": true,
      "example": "abc-123"
    }
  ],
  "request_example": {
    "method": "GET",
    "url": "https://api.example.com/v1/data/abc-123",
    "headers": { "Accept": "application/json" }
  },
  "response_example": {
    "status": 200,
    "body": { "id": "abc-123", "value": "Hello" }
  }
}`}</CodeBlock>
        </div>
      </section>

      {/* Step 2 */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
            2
          </span>
          <h2 className="text-2xl font-bold">
            Host it at <code className="text-accent">/.well-known/agent</code>
          </h2>
        </div>
        <p className="mt-4 text-muted">
          Serve your manifest at the well-known path. That&apos;s all agents need
          to find you.
        </p>

        <div className="mt-6">
          <CodeBlock title="Express.js">{`app.get('/.well-known/agent', (req, res) => {
  res.json(manifest);
});`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="FastAPI (Python)">{`@app.get("/.well-known/agent")
def agent_manifest():
    return manifest`}</CodeBlock>
        </div>

        <div className="mt-4">
          <CodeBlock title="Next.js Route Handler">{`// app/.well-known/agent/route.ts
import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(manifest);
}`}</CodeBlock>
        </div>

        <p className="mt-4 text-sm text-muted">
          Set <code className="text-accent">Content-Type: application/json</code>.
          Add CORS headers if your API is public. Cache with{" "}
          <code className="text-accent">Cache-Control: max-age=3600</code> for
          performance.
        </p>
      </section>

      {/* Step 3 */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent/10 font-mono text-sm font-bold text-accent">
            3
          </span>
          <h2 className="text-2xl font-bold">Submit to the registry</h2>
        </div>
        <p className="mt-4 text-muted">
          Once your endpoint is live, submit your domain. The registry will
          crawl your manifest, validate it, and make your API discoverable.
        </p>

        <div className="mt-6 flex gap-4">
          <Link
            href="/submit"
            className="rounded-lg bg-accent px-5 py-2.5 font-medium text-black transition-colors hover:bg-accent-light"
          >
            Submit your service
          </Link>
          <Link
            href="/playground"
            className="rounded-lg border border-white/10 px-5 py-2.5 font-medium text-foreground transition-colors hover:border-white/25 hover:bg-white/5"
          >
            Test in playground first
          </Link>
        </div>
      </section>

      {/* Why */}
      <section className="mt-16 rounded-xl border border-accent/20 bg-accent/5 p-8">
        <h2 className="text-2xl font-bold">Why do this?</h2>
        <p className="mt-4 text-muted">
          Your API becomes discoverable by every AI agent in the world.
        </p>
        <ul className="mt-4 space-y-3 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">No SDK to maintain.</strong>{" "}
              Agents learn your API from the manifest at runtime.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">No MCP server to build.</strong>{" "}
              The gateway handles all agent-to-API communication.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">
                No partnership to negotiate.
              </strong>{" "}
              Just add the endpoint and submit. Open protocol.
            </span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>
              <strong className="text-foreground">
                Your existing API stays the same.
              </strong>{" "}
              The manifest describes your API — it doesn&apos;t change it.
            </span>
          </li>
        </ul>
      </section>

      {/* FAQ */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">FAQ</h2>

        <div className="mt-8 space-y-8">
          <div>
            <h3 className="font-semibold">
              Do I need to change my existing API?
            </h3>
            <p className="mt-2 text-sm text-muted">
              No. The manifest is a <em>description</em> of your API, not a
              modification. Your existing endpoints, auth, and behavior stay
              exactly the same. You just add one new endpoint that describes
              them.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">What about authentication?</h3>
            <p className="mt-2 text-sm text-muted">
              Just declare it in the <code className="text-accent">auth</code>{" "}
              field of your manifest. Supported types:{" "}
              <code className="text-accent">none</code>,{" "}
              <code className="text-accent">api_key</code>, and{" "}
              <code className="text-accent">oauth2</code>. For API keys, you can
              specify the header name and prefix. For OAuth2, provide the
              authorization and token URLs.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">What about pricing?</h3>
            <p className="mt-2 text-sm text-muted">
              The <code className="text-accent">pricing</code> field is optional.
              You can set it to <code className="text-accent">free</code>,{" "}
              <code className="text-accent">freemium</code>, or{" "}
              <code className="text-accent">paid</code> and list your plans.
              Agents see this information and can guide users through
              subscriptions.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">
              How do agents find my specific capability?
            </h3>
            <p className="mt-2 text-sm text-muted">
              Agents search the registry by intent (e.g., &quot;send
              email&quot;). The registry matches against your service name,
              description, and capability names/descriptions. Agents then drill
              down into the specific capability they need — they never load
              everything upfront.
            </p>
          </div>

          <div>
            <h3 className="font-semibold">
              What if I have dozens of capabilities?
            </h3>
            <p className="mt-2 text-sm text-muted">
              List them all in the manifest. Each one has a short description and
              a <code className="text-accent">detail_url</code>. Because agents
              use lazy drill-down, they only fetch the details for the
              capabilities they actually need. Your manifest stays lean.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
