import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Security — AgentDNS",
  description:
    "Trust levels, rate limits, domain protection, reporting, and security practices for the Agent Discovery Protocol registry.",
};

export default function SecurityPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/docs"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Docs
      </Link>

      <h1 className="mt-6 text-4xl font-bold">Security</h1>
      <p className="mt-4 text-lg text-muted">
        How we keep the registry safe for agents and service providers.
      </p>

      {/* Trust Levels */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Trust Levels</h2>
        <p className="mt-4 text-muted">
          Every service in the registry has a trust level. By default, only
          trusted services (verified + community) appear in search results.
        </p>

        <div className="mt-6 space-y-4">
          <div className="rounded-xl border border-accent/20 bg-surface-light p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                Verified
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              The service hosts its own{" "}
              <code className="text-accent">/.well-known/agent</code> manifest.
              The registry crawls and validates it periodically. If the manifest
              becomes unreachable after 3 consecutive failures, the service is
              downgraded to unverified.
            </p>
          </div>

          <div className="rounded-xl border border-blue-500/20 bg-surface-light p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-400">
                Community
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Submitted manually and maintained by the AgentDNS team. The
              service doesn&apos;t host its own manifest but the listing is
              reviewed and trusted.
            </p>
          </div>

          <div className="rounded-xl border border-yellow-500/20 bg-surface-light p-5">
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-sm text-yellow-400">
                Unverified
              </span>
            </div>
            <p className="mt-2 text-sm text-muted">
              Newly submitted or degraded services. Hidden from search by
              default. Agents must pass{" "}
              <code className="text-accent">include_unverified=true</code> to
              see them.
            </p>
          </div>
        </div>
      </section>

      {/* Rate Limits */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Rate Limits</h2>
        <p className="mt-4 text-muted">
          All API endpoints are rate limited to prevent abuse. Limits are
          per-IP.
        </p>

        <div className="mt-6 rounded-xl border border-white/5 bg-surface-light p-5">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/5">
                <th className="pb-2 text-left font-medium">Endpoint</th>
                <th className="pb-2 text-left font-medium">Limit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              <tr>
                <td className="py-2 font-mono text-accent">POST /api/services</td>
                <td className="py-2 text-muted">5 per hour</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-accent">POST /api/verify/[domain]</td>
                <td className="py-2 text-muted">3 per hour</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-accent">GET /api/discover</td>
                <td className="py-2 text-muted">60 per minute</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-accent">GET /api/services</td>
                <td className="py-2 text-muted">60 per minute</td>
              </tr>
              <tr>
                <td className="py-2 font-mono text-accent">POST /api/reports</td>
                <td className="py-2 text-muted">3 per hour</td>
              </tr>
            </tbody>
          </table>
        </div>

        <p className="mt-4 text-sm text-muted">
          When rate limited, the API returns HTTP 429 with a{" "}
          <code className="text-accent">Retry-After</code> header indicating
          when you can retry.
        </p>
      </section>

      {/* Domain Protection */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Domain Protection</h2>
        <p className="mt-4 text-muted">
          To prevent domain squatting, manual submissions are blocked for
          major domains (Google, Amazon, Stripe, GitHub, etc.). To register
          a protected domain, use auto-discover mode — the service must
          actually host a{" "}
          <code className="text-accent">/.well-known/agent</code> manifest,
          proving ownership.
        </p>
        <p className="mt-3 text-sm text-muted">
          Admin-blocked domains are rejected in all submission modes.
        </p>
      </section>

      {/* Input Validation */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Input Validation</h2>
        <p className="mt-4 text-muted">
          All inputs are validated and sanitized before processing.
        </p>
        <ul className="mt-4 space-y-2 text-sm text-muted">
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>All URLs must use HTTPS (no HTTP, javascript:, data:, or file: schemes)</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>SSRF protection: localhost and private IPs are rejected</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>HTML tags are stripped from all text fields</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>Detail URLs must be relative or same-domain HTTPS</span>
          </li>
          <li className="flex items-start gap-2">
            <span className="mt-0.5 text-accent">&#10003;</span>
            <span>Domain format validation (no IPs, no ports)</span>
          </li>
        </ul>
      </section>

      {/* Reporting */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Reporting</h2>
        <p className="mt-4 text-muted">
          Found a service that violates our policies or appears malicious? You
          can report it directly from the service detail page using the
          &quot;Report&quot; button, or via the API:
        </p>

        <div className="mt-6 rounded-xl border border-white/5 bg-surface">
          <div className="border-b border-white/5 px-4 py-2">
            <span className="font-mono text-xs text-muted">Report a service</span>
          </div>
          <pre className="overflow-x-auto p-4 font-mono text-sm leading-relaxed">
            <code className="text-accent-light">{`POST /api/reports
Content-Type: application/json

{
  "domain": "suspicious-service.com",
  "reason": "Phishing — impersonating a legitimate service"
}`}</code>
          </pre>
        </div>

        <p className="mt-4 text-sm text-muted">
          Reports are reviewed by the AgentDNS team. Confirmed violations
          result in the service being blocked.
        </p>
      </section>

      {/* Security Headers */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">Security Headers</h2>
        <p className="mt-4 text-muted">
          All responses include security headers: Content-Security-Policy,
          X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, and
          Referrer-Policy. CORS is enabled for API endpoints to support
          cross-origin agent requests.
        </p>
      </section>

      {/* Contact */}
      <section className="mt-16 rounded-xl border border-accent/20 bg-accent/5 p-8">
        <h2 className="text-xl font-bold">Security Contact</h2>
        <p className="mt-3 text-sm text-muted">
          Found a security vulnerability? Please report it responsibly to{" "}
          <a
            href="mailto:yann.fl95@gmail.com"
            className="text-accent hover:underline"
          >
            yann.fl95@gmail.com
          </a>
          . We take security seriously and will respond promptly.
        </p>
      </section>
    </div>
  );
}
