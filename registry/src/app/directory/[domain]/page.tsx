import { notFound } from "next/navigation";
import Link from "next/link";
import { getServiceByDomain, getCapabilitiesForService } from "@/lib/db";
import { VerifyButton } from "./verify-button";
import { ManifestToggle } from "./manifest-toggle";
import { ReportButton } from "./report-button";
import { HealthSection } from "./health-section";

export async function generateMetadata(props: { params: Promise<{ domain: string }> }) {
  const { domain } = await props.params;
  const service = await getServiceByDomain(domain);
  if (!service) return { title: "Not Found — AgentDNS" };
  return { title: `${service.name} — AgentDNS` };
}

export default async function ServiceDetailPage(props: {
  params: Promise<{ domain: string }>;
}) {
  const { domain } = await props.params;
  const service = await getServiceByDomain(domain);
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

  // Pick top capabilities (list/get/create operations with detail_json)
  const TOP_VERBS = ["list", "get", "search", "send", "create"];
  const topCaps = capabilities
    .filter((c) => c.detail_json)
    .map((c) => {
      const lower = c.name.toLowerCase();
      let score = 0;
      for (let i = 0; i < TOP_VERBS.length; i++) {
        if (lower.endsWith(`_${TOP_VERBS[i]}`) || lower.startsWith(`${TOP_VERBS[i]}_`)) {
          score = TOP_VERBS.length - i;
          break;
        }
      }
      return { ...c, score };
    })
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  // Group capabilities by resource_group
  const groups = new Map<string, typeof capabilities>();
  for (const cap of capabilities) {
    const group = cap.resource_group ?? "other";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group)!.push(cap);
  }
  const hasGroups = groups.size > 1 || !groups.has("other");

  // Parse setup guide if available
  const guide = service.setup_guide
    ? ((typeof service.setup_guide === "string"
        ? JSON.parse(service.setup_guide)
        : service.setup_guide) as {
        portal_url?: string;
        auth_type?: string;
        steps?: string[];
        credential_fields?: Array<{ name: string; label?: string; description?: string; secret?: boolean }>;
        test_endpoint?: { method: string; path: string; expected_status: number };
        notes?: string;
      })
    : null;

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
            <span className="text-xs text-muted">Last crawled</span>
            <p className="font-mono text-sm">
              {(() => {
                try {
                  return new Date(service.last_crawled_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
                } catch {
                  return service.last_crawled_at;
                }
              })()}
            </p>
          </div>
        )}
      </div>

      {/* Health */}
      <HealthSection domain={service.domain} trustLevel={service.trust_level} />

      {/* Top Capabilities */}
      {topCaps.length > 0 && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Top Capabilities</h2>
          <p className="mt-2 text-sm text-muted">
            Most commonly used operations — ready to call without drill-down.
          </p>
          <div className="mt-6 space-y-4">
            {topCaps.map((cap) => {
              const detail = cap.detail_json as Record<string, unknown> | null;
              if (!detail) return null;
              const method = (detail.method as string) ?? "GET";
              const endpoint = (detail.endpoint as string) ?? "";
              const fullEndpoint = endpoint.startsWith("http")
                ? endpoint
                : `${service.base_url}${endpoint}`;
              const params = (detail.parameters as Array<{ name: string; type: string; required: boolean; description: string }>) ?? [];

              return (
                <div
                  key={cap.id}
                  className="rounded-xl border border-accent/20 bg-surface-light p-5"
                >
                  <div className="flex items-start justify-between">
                    <h3 className="font-mono font-semibold text-accent">
                      {cap.name}
                    </h3>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 font-mono text-xs text-accent">
                      {method}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted">
                    {cap.description}
                  </p>
                  <p className="mt-3 font-mono text-xs text-accent-light">
                    {method} {fullEndpoint}
                  </p>
                  {params.length > 0 && (
                    <div className="mt-3 space-y-1">
                      {params.slice(0, 5).map((p) => (
                        <p key={p.name} className="font-mono text-xs text-muted">
                          <span className="text-white/70">{p.name}</span>{" "}
                          <span className="text-muted">({p.type}{p.required ? ", required" : ""})</span>{" "}
                          — {p.description}
                        </p>
                      ))}
                      {params.length > 5 && (
                        <p className="font-mono text-xs text-muted">
                          ...and {params.length - 5} more parameters
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* All Capabilities */}
      <section className="mt-12">
        <h2 className="text-2xl font-bold">
          All Capabilities <span className="text-lg font-normal text-muted">({capabilities.length})</span>
        </h2>
        <div className="mt-6 space-y-6">
          {hasGroups ? (
            Array.from(groups.entries()).map(([group, caps]) => (
              <div key={group}>
                <h3 className="font-mono text-sm font-semibold text-white/70">
                  {group} <span className="font-normal text-muted">({caps.length})</span>
                </h3>
                <div className="mt-3 space-y-3">
                  {caps.map((cap) => {
                    const detail = cap.detail_json as Record<string, unknown> | null;
                    const method = detail ? (detail.method as string) : null;
                    return (
                      <div
                        key={cap.id}
                        className="rounded-lg border border-white/5 bg-surface-light p-4"
                      >
                        <div className="flex items-center gap-2">
                          {method && (
                            <span className="rounded bg-surface px-1.5 py-0.5 font-mono text-xs text-muted">
                              {method}
                            </span>
                          )}
                          <span className="font-mono text-sm font-semibold text-accent">
                            {cap.name}
                          </span>
                        </div>
                        <p className="mt-1 text-sm text-muted">{cap.description}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          ) : (
            capabilities.map((cap) => {
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
            })
          )}
        </div>
      </section>

      {/* Setup Guide */}
      {guide && (
        <section className="mt-12">
          <h2 className="text-2xl font-bold">Developer Setup Guide</h2>
          <p className="mt-2 text-sm text-muted">
            How to get credentials and connect to this service.
          </p>
          <div className="mt-4 rounded-xl border border-accent/20 bg-surface-light p-6 space-y-5">
            {guide.portal_url && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Developer Portal</h3>
                <a
                  href={guide.portal_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block font-mono text-sm text-accent hover:underline"
                >
                  {guide.portal_url} &rarr;
                </a>
              </div>
            )}
            {guide.steps && guide.steps.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Setup Steps</h3>
                <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-muted">
                  {guide.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
              </div>
            )}
            {guide.credential_fields && guide.credential_fields.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Credential Fields</h3>
                <div className="mt-2 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-white/10 text-left text-xs text-muted">
                        <th className="pb-2 pr-4">Field</th>
                        <th className="pb-2 pr-4">Label</th>
                        <th className="pb-2 pr-4">Description</th>
                        <th className="pb-2">Secret</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                      {guide.credential_fields.map((f) => (
                        <tr key={f.name}>
                          <td className="py-2 pr-4 font-mono text-accent">{f.name}</td>
                          <td className="py-2 pr-4 text-muted">{f.label ?? f.name}</td>
                          <td className="py-2 pr-4 text-muted">{f.description ?? "\u2014"}</td>
                          <td className="py-2 text-muted">{f.secret ? "Yes" : "No"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {guide.test_endpoint && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Test Endpoint</h3>
                <p className="mt-1 font-mono text-sm text-muted">
                  {guide.test_endpoint.method} {guide.test_endpoint.path}{" "}
                  <span className="text-accent">
                    (expects {guide.test_endpoint.expected_status})
                  </span>
                </p>
              </div>
            )}
            {guide.notes && (
              <div>
                <h3 className="text-sm font-semibold text-foreground">Notes</h3>
                <p className="mt-1 text-sm text-muted">{guide.notes}</p>
              </div>
            )}
          </div>
        </section>
      )}

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
Capabilities (${capabilities.length} total):
${hasGroups
  ? Array.from(groups.entries()).map(([g, caps]) => `  ${g} (${caps.length}):\n${caps.map((c) => `    - ${c.name}: ${c.description}`).join("\n")}`).join("\n")
  : capabilities.map((c) => `  - ${c.name}: ${c.description}`).join("\n")}${
topCaps.length > 0
  ? `\n\nTop capabilities (ready to call):\n${topCaps.map((c) => {
      const d = c.detail_json as Record<string, unknown> | null;
      if (!d) return `  - ${c.name}`;
      return `  - ${c.name}: ${d.method} ${d.endpoint}`;
    }).join("\n")}`
  : ""
}`}
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
