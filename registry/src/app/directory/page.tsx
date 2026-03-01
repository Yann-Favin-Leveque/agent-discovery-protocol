import Link from "next/link";
import type { Metadata } from "next";
import { getAllServices, getAllCategories } from "@/lib/db";
import type { ServiceListItem } from "@/lib/db";

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

const PER_PAGE = 20;

function TrustBadge({ level }: { level: string }) {
  const badge =
    level === "verified" ? (
      <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
        Verified
      </span>
    ) : level === "community" ? (
      <span className="rounded-full bg-blue-500/10 px-2 py-0.5 text-xs text-blue-400">
        Community
      </span>
    ) : (
      <span className="rounded-full bg-yellow-500/10 px-2 py-0.5 text-xs text-yellow-400">
        Unverified
      </span>
    );

  return (
    <Link
      href="/docs/trust-levels"
      onClick={(e) => e.stopPropagation()}
      className="hover:opacity-80 transition-opacity"
      title="Learn about trust levels"
    >
      {badge}
    </Link>
  );
}

function ServiceCard({ service }: { service: ServiceListItem }) {
  return (
    <Link
      href={`/directory/${service.domain}`}
      className="group rounded-xl border border-white/5 bg-surface-light p-5 transition-colors hover:border-accent/30 hover:bg-surface-lighter"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold group-hover:text-accent">{service.name}</h3>
        <TrustBadge level={service.trust_level} />
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
          {service.cap_count} {service.cap_count === 1 ? "capability" : "capabilities"}
        </span>
      </div>
    </Link>
  );
}

/** Compute visible page numbers with ellipsis gaps. */
function getPageRange(current: number, total: number): (number | "ellipsis")[] {
  if (total <= 7) {
    return Array.from({ length: total }, (_, i) => i + 1);
  }

  const pages: (number | "ellipsis")[] = [];

  // Always show first page
  pages.push(1);

  if (current > 3) {
    pages.push("ellipsis");
  }

  // Pages around current
  const start = Math.max(2, current - 1);
  const end = Math.min(total - 1, current + 1);
  for (let i = start; i <= end; i++) {
    pages.push(i);
  }

  if (current < total - 2) {
    pages.push("ellipsis");
  }

  // Always show last page
  pages.push(total);

  return pages;
}

function Pagination({
  currentPage,
  totalPages,
  total,
  perPage,
  buildPageUrl,
}: {
  currentPage: number;
  totalPages: number;
  total: number;
  perPage: number;
  buildPageUrl: (page: number) => string;
}) {
  if (total === 0) return null;

  const rangeStart = (currentPage - 1) * perPage + 1;
  const rangeEnd = Math.min(currentPage * perPage, total);
  const pages = getPageRange(currentPage, totalPages);

  return (
    <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
      {/* Range display */}
      <p className="text-sm text-muted">
        Showing{" "}
        <span className="font-medium text-foreground">{rangeStart}</span>
        &ndash;
        <span className="font-medium text-foreground">{rangeEnd}</span>
        {" "}of{" "}
        <span className="font-medium text-foreground">{total}</span>
        {" "}services
      </p>

      {/* Navigation */}
      {totalPages > 1 && (
        <nav aria-label="Pagination" className="flex items-center gap-1">
          {/* Previous */}
          {currentPage > 1 ? (
            <Link
              href={buildPageUrl(currentPage - 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
              aria-label="Previous page"
            >
              <span aria-hidden="true">&larr;</span> Prev
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-lg border border-white/5 px-3 py-1.5 text-sm text-white/20">
              <span aria-hidden="true">&larr;</span> Prev
            </span>
          )}

          {/* Page numbers */}
          <div className="flex items-center gap-1 px-1">
            {pages.map((page, idx) =>
              page === "ellipsis" ? (
                <span
                  key={`ellipsis-${idx}`}
                  className="px-2 py-1.5 text-sm text-white/30"
                >
                  &hellip;
                </span>
              ) : page === currentPage ? (
                <span
                  key={page}
                  className="min-w-[2rem] rounded-lg bg-accent px-2 py-1.5 text-center text-sm font-medium text-black"
                  aria-current="page"
                >
                  {page}
                </span>
              ) : (
                <Link
                  key={page}
                  href={buildPageUrl(page)}
                  className="min-w-[2rem] rounded-lg border border-white/5 px-2 py-1.5 text-center text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
                >
                  {page}
                </Link>
              )
            )}
          </div>

          {/* Next */}
          {currentPage < totalPages ? (
            <Link
              href={buildPageUrl(currentPage + 1)}
              className="rounded-lg border border-white/10 px-3 py-1.5 text-sm text-muted transition-colors hover:border-accent/30 hover:text-foreground"
              aria-label="Next page"
            >
              Next <span aria-hidden="true">&rarr;</span>
            </Link>
          ) : (
            <span className="cursor-not-allowed rounded-lg border border-white/5 px-3 py-1.5 text-sm text-white/20">
              Next <span aria-hidden="true">&rarr;</span>
            </span>
          )}
        </nav>
      )}
    </div>
  );
}

export default async function DirectoryPage({
  searchParams,
}: {
  searchParams: { category?: string; search?: string; sort?: string; show_unverified?: string; page?: string };
}) {
  const categories = await getAllCategories();
  const sort = (searchParams.sort as "newest" | "name" | "capabilities") ?? "newest";
  const showUnverified = searchParams.show_unverified === "true";
  const currentPage = Math.max(1, parseInt(searchParams.page ?? "1", 10) || 1);
  const offset = (currentPage - 1) * PER_PAGE;

  const { services, total } = await getAllServices({
    category: searchParams.category,
    search: searchParams.search,
    sort,
    limit: PER_PAGE,
    offset,
    include_unverified: showUnverified,
  });

  const totalPages = Math.max(1, Math.ceil(total / PER_PAGE));

  const activeCategory = searchParams.category ?? "all";

  // Build query string for links — preserves all current filters
  function buildQuery(overrides: Record<string, string | undefined>) {
    const params: Record<string, string> = {
      sort,
      category: activeCategory,
    };
    if (searchParams.search) params.search = searchParams.search;
    if (showUnverified) params.show_unverified = "true";
    // Apply overrides — delete keys set to undefined
    for (const [key, value] of Object.entries(overrides)) {
      if (value === undefined) {
        delete params[key];
      } else {
        params[key] = value;
      }
    }
    // Remove defaults to keep URLs clean
    if (params.category === "all") delete params.category;
    if (params.show_unverified === "false") delete params.show_unverified;
    if (params.sort === "newest") delete params.sort;
    if (params.page === "1") delete params.page;
    const qs = new URLSearchParams(params).toString();
    return `/directory${qs ? `?${qs}` : ""}`;
  }

  // Build URL for a specific page number (preserves all filters)
  function buildPageUrl(page: number) {
    return buildQuery({ page: String(page) });
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Service Directory</h1>
          <p className="mt-2 text-muted">
            {total} {total === 1 ? "service" : "services"}{showUnverified ? " total" : " trusted"}
          </p>
        </div>

        {/* Search — resets to page 1 */}
        <form method="GET" action="/directory" className="flex gap-2">
          {activeCategory !== "all" && <input type="hidden" name="category" value={activeCategory} />}
          {sort !== "newest" && <input type="hidden" name="sort" value={sort} />}
          {showUnverified && <input type="hidden" name="show_unverified" value="true" />}
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

      {/* Filters — all reset to page 1 */}
      <div className="mt-8 flex flex-wrap items-center gap-4">
        {/* Categories */}
        <div className="flex flex-wrap gap-2">
          <Link
            href={buildQuery({ category: undefined, page: undefined })}
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
              href={buildQuery({ category: cat.slug, page: undefined })}
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

        {/* Sort + Unverified toggle — reset to page 1 */}
        <div className="ml-auto flex items-center gap-4 text-xs text-muted">
          {/* Unverified toggle */}
          <Link
            href={buildQuery({ show_unverified: showUnverified ? "false" : "true", page: undefined })}
            className={`rounded-md px-2 py-1 transition-colors ${
              showUnverified
                ? "bg-yellow-500/10 text-yellow-400"
                : "hover:text-foreground"
            }`}
          >
            {showUnverified ? "Showing all" : "Show unverified"}
          </Link>

          <span className="text-white/20">|</span>

          <span>Sort:</span>
          {(["newest", "name", "capabilities"] as const).map((s) => (
            <Link
              key={s}
              href={buildQuery({ sort: s, page: undefined })}
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
        <>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {services.map((service) => (
              <ServiceCard
                key={service.id}
                service={service}
              />
            ))}
          </div>

          {/* Pagination */}
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            total={total}
            perPage={PER_PAGE}
            buildPageUrl={buildPageUrl}
          />
        </>
      )}
    </div>
  );
}
