import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Trust Levels — AgentDNS",
  description:
    "Understand the three trust levels in the AgentDNS registry: Verified, Community, and Unverified. Learn how verification works and how to upgrade.",
};

export default function TrustLevelsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-24">
      <Link
        href="/docs"
        className="text-sm text-muted transition-colors hover:text-accent"
      >
        &larr; Docs
      </Link>

      <h1 className="mt-6 text-4xl font-bold">Trust Levels</h1>
      <p className="mt-4 text-lg text-muted">
        Every service in the AgentDNS registry has a trust level that determines
        how it appears in search results, whether it&apos;s health-monitored, and
        how much agents should trust it.
      </p>

      {/* Comparison table */}
      <div className="mt-12 overflow-x-auto rounded-xl border border-white/5 bg-surface-light">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="px-4 py-3 text-left font-medium text-muted" />
              <th className="px-4 py-3 text-center font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-accent">
                  Verified
                </span>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3 py-1 text-blue-400">
                  Community
                </span>
              </th>
              <th className="px-4 py-3 text-center font-medium">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-yellow-500/10 px-3 py-1 text-yellow-400">
                  Unverified
                </span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/5">
            <tr>
              <td className="px-4 py-3 text-muted">In search results</td>
              <td className="px-4 py-3 text-center text-accent">Default</td>
              <td className="px-4 py-3 text-center text-accent">Default</td>
              <td className="px-4 py-3 text-center text-red-400">Hidden</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted">Health monitored</td>
              <td className="px-4 py-3 text-center text-accent">Hourly</td>
              <td className="px-4 py-3 text-center text-muted">N/A</td>
              <td className="px-4 py-3 text-center text-muted">N/A</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted">Manifest source</td>
              <td className="px-4 py-3 text-center">Service itself</td>
              <td className="px-4 py-3 text-center">AgentDNS team</td>
              <td className="px-4 py-3 text-center">Third party</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted">API callable</td>
              <td className="px-4 py-3 text-center text-accent">Yes</td>
              <td className="px-4 py-3 text-center text-accent">Yes</td>
              <td className="px-4 py-3 text-center text-yellow-400">Use caution</td>
            </tr>
            <tr>
              <td className="px-4 py-3 text-muted">Domain confirmed</td>
              <td className="px-4 py-3 text-center text-accent">Yes</td>
              <td className="px-4 py-3 text-center text-muted">No</td>
              <td className="px-4 py-3 text-center text-muted">No</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Verified */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-accent/10 px-3 py-1 text-sm font-medium text-accent">
            Verified
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            The service hosts its own{" "}
            <code className="rounded bg-surface px-1.5 py-0.5 text-accent">/.well-known/agent</code>{" "}
            endpoint.
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>The registry has crawled and validated the live manifest</li>
            <li>Health is actively monitored (checked hourly)</li>
            <li>The domain is confirmed — this is the real service</li>
          </ul>
          <div className="mt-4 rounded-lg border border-accent/20 bg-accent/5 p-4">
            <p className="font-medium text-accent">
              This is the gold standard.
            </p>
            <p className="mt-1 text-muted">
              If you&apos;re a service provider, self-host your manifest to earn this badge.
              Use our SDKs to add the endpoint in 2 minutes.
            </p>
          </div>
        </div>
      </section>

      {/* Community */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm font-medium text-blue-400">
            Community
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>
            Manifest written and maintained by the AgentDNS team based on public API documentation.
          </p>
          <ul className="ml-4 list-disc space-y-2">
            <li>The service itself has not adopted the protocol (yet)</li>
            <li>The API works — agents can discover and call it through the gateway</li>
            <li>
              Health monitoring is not available since there&apos;s no{" "}
              <code className="rounded bg-surface px-1.5 py-0.5 text-blue-400">/.well-known/agent</code>{" "}
              endpoint to check
            </li>
          </ul>
          <div className="mt-4 rounded-lg border border-yellow-500/20 bg-yellow-500/5 p-4">
            <p className="font-medium text-yellow-400">
              If this API changes, the manifest may become outdated.
            </p>
          </div>
          <p className="mt-4">
            If you&apos;re the owner of a community-listed service and want to take ownership,
            contact us or self-host your manifest to upgrade to Verified.
          </p>
        </div>
      </section>

      {/* Unverified */}
      <section className="mt-16">
        <div className="flex items-center gap-3">
          <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-sm font-medium text-yellow-400">
            Unverified
          </span>
        </div>
        <div className="mt-4 space-y-3 text-sm leading-relaxed text-muted">
          <p>Submitted by a third party, not yet reviewed.</p>
          <ul className="ml-4 list-disc space-y-2">
            <li>Hidden from search results by default</li>
            <li>Use with caution — the manifest has not been validated by the AgentDNS team</li>
            <li>May be promoted to Community after review, or removed if found to be malicious</li>
          </ul>
        </div>
      </section>

      {/* How verification works */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">How verification works</h2>
        <div className="mt-6 space-y-4">
          {[
            {
              step: "1",
              text: (
                <>
                  Your service hosts{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-accent">
                    GET /.well-known/agent
                  </code>{" "}
                  &rarr; returns a valid manifest JSON
                </>
              ),
            },
            {
              step: "2",
              text: (
                <>
                  Submit your domain at{" "}
                  <Link href="/submit" className="text-accent hover:underline">
                    agent-dns.dev/submit
                  </Link>{" "}
                  or the registry discovers it
                </>
              ),
            },
            {
              step: "3",
              text: "The registry fetches the manifest, validates it, and checks at least one detail_url resolves",
            },
            {
              step: "4",
              text: (
                <>
                  If everything passes &rarr;{" "}
                  <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                    Verified
                  </span>
                </>
              ),
            },
            {
              step: "5",
              text: "The registry re-checks every hour. If 3 consecutive checks fail, the service is marked as unreachable",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent/10 font-mono text-sm font-bold text-accent">
                {item.step}
              </span>
              <p className="self-center text-sm text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Upgrade from Community */}
      <section className="mt-16">
        <h2 className="text-2xl font-bold">
          Want to upgrade from Community to Verified?
        </h2>
        <p className="mt-4 text-muted">
          If your service is listed as Community and you want to take ownership:
        </p>
        <div className="mt-6 space-y-4">
          {[
            {
              step: "1",
              text: (
                <>
                  Add the{" "}
                  <code className="rounded bg-surface px-1.5 py-0.5 text-accent">
                    /.well-known/agent
                  </code>{" "}
                  endpoint to your API (use our{" "}
                  <Link href="/docs/providers" className="text-accent hover:underline">
                    SDKs
                  </Link>{" "}
                  to do it in 2 minutes)
                </>
              ),
            },
            {
              step: "2",
              text: (
                <>
                  Submit your domain at{" "}
                  <Link href="/submit" className="text-accent hover:underline">
                    /submit
                  </Link>{" "}
                  or contact us
                </>
              ),
            },
            {
              step: "3",
              text: "The registry crawls your live endpoint and upgrades you to Verified",
            },
            {
              step: "4",
              text: "You now control your own manifest and get health monitoring",
            },
          ].map((item) => (
            <div key={item.step} className="flex gap-4">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/10 font-mono text-sm font-bold text-blue-400">
                {item.step}
              </span>
              <p className="self-center text-sm text-muted">{item.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="mt-16 rounded-xl border border-accent/20 bg-gradient-to-r from-accent/5 via-transparent to-accent/5 p-8 text-center">
        <h2 className="text-xl font-bold">
          Add the protocol to your API
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-sm text-muted">
          Use our SDKs for Express, FastAPI, Next.js, or Spring Boot. Add the{" "}
          <code className="text-accent">/.well-known/agent</code> endpoint in 2 minutes,
          get verified, and make your API discoverable by every AI agent.
        </p>
        <Link
          href="/docs/providers"
          className="mt-6 inline-block rounded-lg bg-accent px-6 py-3 font-medium text-black transition-colors hover:bg-accent-light"
        >
          Get started &rarr;
        </Link>
      </section>
    </div>
  );
}
