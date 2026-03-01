import Link from "next/link";
import type { Metadata } from "next";
import { getAllServices, getAllCategories, getCapabilitiesForService } from "@/lib/db";
import type { ServiceRow } from "@/lib/db";

export const metadata: Metadata = {
  title: "Directory — AgentDNS",
  description:
    "Browse all services implementing the Agent Discovery Protocol. Filter by category, search by name, explore capabilities.",
  openGraph: {
    title: "Service Directory — AgentDNS",
    description:
      "Browse all API services discoverable by AI agents through the Agent Discovery Protocol.",
  },
};

function ServiceCard({ service, capCount }: { service: ServiceRow; capCount: number }) {
  return (
    <Link
      href={`/directory/${service.domain}`}
      className="group rounded-xl border border-white/5 bg-surface-light p-5 transition-colors hover:border-accent/30 hover:bg-surface-lighter"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold group-hover:text-accent">{service.name}</h3>
        <div className="flex gap-2">
          {service.verified ? (
            <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
              Verified
            </span>
          ) : (
            <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
              Unverified
            </span>
          )}
        </div>
      </div>

      <p className="mt-1 font-mono text-xs text-muted">{service.domain}</p>

      <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-muted">
        {service.description}
      </p>

      <div className="mt-4 flex items-center gap-3">
        <span className="rounded-md bg-surface px-2 py-0.5 font-mono text-xs text-muted">
          {service.auth_type}
        </span>
        <span className="text-xs text-muted">
          {capCount} {capCount === 1 ? "capability" : "capabilities"}
        </span>
      </div>
    </Link>
  );
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; sort?: string };
}) {
  const categories = await getAllCategories();
  const sort = (searchParams.sort as "newest" | "name" | "capabilities") ?? "newest";
  const { services, total } = await getAllServices({
    category: searchParams.category,
    search: searchParams.search,
    sort,
    limit: 50,
    offset: 0,
  });

  // Precompute capability counts
  const capCounts = new Map<number, number>();
  for (const s of services) {
    const caps = await getCapabilitiesForService(s.id);
    capCounts.set(s.id, caps.length);
  }

  const activeCategory = searchParams.category ?? "all";

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Service Directory</h1>
          <p className="mt-2 text-muted">
            {total} {total === 1 ? "service" : "services"} indexed
          </p>
        </div>

        {/* Search */}
        <form method="GET" action="/directory" className="flex gap-2">
          <input type="hidden" name="category" value={activeCategory} />
          <input type="hidden" name="sort" value={sort} />
          <input
            name="search"
            type="text"
            defaultValue={searchParams.search ?? ""}
            placeholder="Search services..."
            className="w-64 rounded-lg border border-white/10 bg-surface-light px-4 py-2 text-sm text-foreground placeholder:text-muted/50 focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            type="submit"
            className="rounded-lg bg-accent px-4 py-2 text-sm font-medium text-black hover:bg-accent-light"
          >
            Search
          </button>
        </form>
      </div>

      {/* Filters */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/directory?sort=${sort}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              activeCategory === "all"
                ? "bg-accent text-black"
                : "border border-white/10 text-muted hover:text-foreground"
            }`}
          >
            All
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat.slug}
              href={`/directory?category=${cat.slug}&sort=${sort}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat.slug
                  ? "bg-accent text-black"
                  : "border border-white/10 text-muted hover:text-foreground"
              }`}
            >
              {cat.name}
            </Link>
          ))}
        </div>

        {/* Sort */}
        <div className="ml-auto flex items-center gap-2 text-xs text-muted">
          <span>Sort:</span>
          {(["newest", "name", "capabilities"] as const).map((s) => (
            <Link
              key={s}
              href={`/directory?sort=${s}&category=${activeCategory}${searchParams.search ? `&search=${searchParams.search}` : ""}`}
              className={`rounded-md px-2 py-1 transition-colors ${
                sort === s
                  ? "bg-white/10 text-foreground"
                  : "hover:text-foreground"
              }`}
            >
              {s}
            </Link>
          ))}
        </div>
      </div>

      {/* Grid */}
      {services.length === 0 ? (
        <div className="mt-16 text-center">
          <p className="text-lg text-muted">No services found.</p>
          <p className="mt-2 text-sm text-muted">
            Be the first to{" "}
            <Link href="/submit" className="text-accent hover:underline">
              submit a service
            </Link>
            .
          </p>
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => (
            <ServiceCard
              key={service.id}
              service={service}
              capCount={capCounts.get(service.id) ?? 0}
            />
          ))}
        </div>
      )}
    </div>
  );
}
