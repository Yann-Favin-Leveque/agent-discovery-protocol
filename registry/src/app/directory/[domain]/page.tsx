import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceByDomain, getCapabilitiesForService } from "@/lib/db";
import { VerifyButton } from "./verify-button";
import { ManifestToggle } from "./manifest-toggle";
import { ReportButton } from "./report-button";
import { HealthSection } from "./health-section";

export async function generateMetadata({ params }: { params: { domain: string } }) {
  const service = await getServiceByDomain(params.domain);
  if (!service) return { title: "Not Found — AgentDNS" };
  return { title: `${service.name} — AgentDNS` };
}

export default async function ServiceDetailPage({
  params,
}: {
  params: { domain: string };
}) {
  const service = await getServiceByDomain(params.domain);
  if (!service) notFound();

  const capabilities = await getCapabilitiesForService(service.id);
  const auth = JSON.parse(service.auth_details);

  const manifest = {
    spec_version: service.spec_version,
    name: service.name,
    description: service.description,
    base_url: service.base_url,
    auth,
    pricing: { type: service.pricing_type },
    capabilities: capabilities.map((c) => ({
      name: c.name,
      description: c.description,
      detail_url: c.detail_url,
    })),
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-16">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">{service.name}</h1>
          <p className="mt-1 font-mono text-sm text-muted">{service.domain}</p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/docs/trust-levels"
            className="hover:opacity-80 transition-opacity"
            title="Learn about trust levels"
          >
            {service.trust_level === "verified" ? (
              <span className="rounded-full bg-accent/10 px-3 py-1 text-sm text-accent">
                Verified
              </span>
            ) : service.trust_level === "community" ? (
              <span className="rounded-full bg-blue-500/10 px-3 py-1 text-sm text-blue-400">
                Community
              </span>
            ) : (
              <span className="rounded-full bg-yellow-500/10 px-3 py-1 text-sm text-yellow-400">
                Unverified
              </span>
            )}
          </Link>
          <VerifyButton domain={service.domain} />
          <ReportButton domain={service.domain} />
        </div>
      </div>

      {/* Description */}
      <p className="mt-6 text-lg leading-relaxed text-muted">
        {service.description}
      </p>

      {/* Meta */}
      <div className="mt-6 flex flex-wrap gap-4">
        <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
          <span className="text-xs text-muted">Auth</span>
          <p className="font-mono text-sm">{service.auth_type}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
          <span className="text-xs text-muted">Pricing</span>
          <p className="font-mono text-sm">{service.pricing_type}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
          <span className="text-xs text-muted">Spec version</span>
          <p className="font-mono text-sm">{service.spec_version}</p>
        </div>
        <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
          <span className="text-xs text-muted">Base URL</span>
          <p className="font-mono text-sm">{service.base_url}</p>
        </div>
        {service.crawl_failures > 0 && (
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-2">
            <span className="text-xs text-red-400">Crawl failures</span>
            <p className="font-mono text-sm text-red-300">{service.crawl_failures}</p>
          </div>
        )}
        {service.last_crawled_at && (
          <div className="rounded-lg border border-white/5 bg-surface-light px-4 py-2">
            <span className="text-xs text-muted">Last verified</span>
            <p className="font-mono text-sm">{service.last_crawled_at}</p>
          </div>
        )}
      </div>

      {/* Health */}
      <HealthSection domain={service.domain} trustLevel={service.trust_level} />

      {/* Capabilities */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Capabilities</h2>
        <div className="mt-6 space-y-4">
          {capabilities.map((cap) => {
            const fullUrl = cap.detail_url.startsWith("http")
              ? cap.detail_url
              : `${service.base_url}${cap.detail_url}`;

            return (
              <div
                key={cap.id}
                className="rounded-xl border border-white/5 bg-surface-light p-5"
              >
                <div className="flex items-start justify-between">
                  <h3 className="font-mono font-semibold text-accent">
                    {cap.name}
                  </h3>
                  {cap.category_slug && (
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted">
                      {cap.category_slug}
                    </span>
                  )}
                </div>
                <p className="mt-2 text-sm leading-relaxed text-muted">
                  {cap.description}
                </p>
                <p className="mt-3 font-mono text-xs text-muted">
                  Detail: {fullUrl}
                </p>
              </div>
            );
          })}
        </div>
      </section>

      {/* Agent preview */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">Agent Preview</h2>
        <p className="mt-2 text-sm text-muted">
          This is what an AI agent sees when it discovers this service via the
          Gateway:
        </p>
        <div className="mt-4 rounded-xl border border-accent/20 bg-surface-light p-5">
          <pre className="overflow-x-auto font-mono text-sm leading-relaxed text-accent-light">
{`Service: ${service.name}
Description: ${service.description}
Auth: ${service.auth_type}
Capabilities:
${capabilities.map((c) => `  - ${c.name}: ${c.description}`).join("\n")}`}
          </pre>
        </div>
      </section>

      {/* Raw manifest */}
      <section className="mt-12">
        <ManifestToggle manifest={manifest} />
      </section>
    </div>
  );
}
