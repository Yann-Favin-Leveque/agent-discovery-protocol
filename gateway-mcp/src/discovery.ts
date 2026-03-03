import {
  loadConfig,
  getCachedDiscovery,
  setCachedDiscovery,
  getCachedManifest,
  setCachedManifest,
  getCachedCapability,
  setCachedCapability,
  clearAllCaches,
} from "./config.js";
import type {
  Manifest,
  CapabilityDetail,
  RegistryDiscoverResponse,
  ServiceGuide,
} from "./types.js";
import { CACHE_TTLS } from "./types.js";

// ─── In-memory hot caches ────────────────────────────────────────

const memDiscoveryCache = new Map<string, { result: RegistryDiscoverResponse; at: number }>();
const memManifestCache = new Map<string, { result: Manifest; at: number }>();
const memCapabilityCache = new Map<string, { result: CapabilityDetail; at: number }>();
const memGuideCache = new Map<string, { result: ServiceGuide | null; at: number }>();

// ─── Fetch helper ────────────────────────────────────────────────

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} from ${url}`);
  }
  return res.json() as Promise<T>;
}

// ─── Discovery (15min cache) ─────────────────────────────────────

export async function discoverByQuery(
  query: string,
  options?: { include_unverified?: boolean; force_refresh?: boolean }
): Promise<RegistryDiscoverResponse> {
  const cacheKey = options?.include_unverified ? `${query}:unverified` : query;

  if (!options?.force_refresh) {
    // Check in-memory hot cache
    const mem = memDiscoveryCache.get(cacheKey);
    if (mem && Date.now() - mem.at < CACHE_TTLS.discovery) {
      return mem.result;
    }

    // Check disk cache
    const disk = getCachedDiscovery(cacheKey);
    if (disk) {
      memDiscoveryCache.set(cacheKey, { result: disk, at: Date.now() });
      return disk;
    }
  }

  // Fetch from registry
  const config = loadConfig();
  let url = `${config.registry_url}/api/discover?q=${encodeURIComponent(query)}`;
  if (options?.include_unverified) {
    url += "&include_unverified=true";
  }
  const result = await fetchJson<RegistryDiscoverResponse>(url);

  // Store in both caches
  memDiscoveryCache.set(cacheKey, { result, at: Date.now() });
  setCachedDiscovery(cacheKey, result);

  return result;
}

// ─── Manifest (1h cache) ─────────────────────────────────────────

export async function fetchManifest(
  domain: string,
  options?: { force_refresh?: boolean }
): Promise<Manifest> {
  if (!options?.force_refresh) {
    // Check in-memory hot cache
    const mem = memManifestCache.get(domain);
    if (mem && Date.now() - mem.at < CACHE_TTLS.manifest) {
      return mem.result;
    }

    // Check disk cache
    const disk = getCachedManifest(domain);
    if (disk) {
      memManifestCache.set(domain, { result: disk, at: Date.now() });
      return disk;
    }
  }

  // Fetch: try live /.well-known/agent first, fall back to registry
  let manifest: Manifest;
  try {
    manifest = await fetchJson<Manifest>(`https://${domain}/.well-known/agent`);
  } catch {
    const config = loadConfig();
    const reg = await fetchJson<{ success: boolean; data: { manifest: Manifest; setup_guide?: ServiceGuide } }>(
      `${config.registry_url}/api/services/${encodeURIComponent(domain)}`
    );
    if (!reg.success || !reg.data?.manifest) {
      throw new Error(
        `Service '${domain}' has no /.well-known/agent endpoint and is not in the registry.`
      );
    }
    manifest = reg.data.manifest;

    // Cache guide from registry response
    if (reg.data.setup_guide) {
      memGuideCache.set(domain, { result: reg.data.setup_guide, at: Date.now() });
    }
  }

  // Store in both caches
  memManifestCache.set(domain, { result: manifest, at: Date.now() });
  setCachedManifest(domain, manifest);

  return manifest;
}

// ─── Capability detail (1h cache, service-first, registry fallback) ──

export async function fetchCapabilityDetail(
  domain: string,
  capabilityName: string,
  options?: { force_refresh?: boolean }
): Promise<CapabilityDetail> {
  const cacheKey = `${domain}__${capabilityName}`;

  if (!options?.force_refresh) {
    // Check in-memory hot cache
    const mem = memCapabilityCache.get(cacheKey);
    if (mem && Date.now() - mem.at < CACHE_TTLS.capability) {
      return mem.result;
    }

    // Check disk cache
    const disk = getCachedCapability(domain, capabilityName);
    if (disk) {
      memCapabilityCache.set(cacheKey, { result: disk, at: Date.now() });
      return disk;
    }
  }

  // Need manifest to find detail_url
  const manifest = await fetchManifest(domain, options);
  const cap = manifest.capabilities.find((c) => c.name === capabilityName);
  if (!cap) {
    throw new Error(
      `Capability '${capabilityName}' not found on ${domain}. Available: ${manifest.capabilities.map((c) => c.name).join(", ")}`
    );
  }

  const detailUrl = cap.detail_url.startsWith("http")
    ? cap.detail_url
    : `${manifest.base_url}${cap.detail_url}`;

  let detail: CapabilityDetail | undefined;

  // Step 1: Try the service's own detail_url
  try {
    detail = await fetchJson<CapabilityDetail>(detailUrl);
  } catch {
    // Fall through to registry
  }

  // Step 2: Fallback to registry's stored capability detail
  if (!detail) {
    const config = loadConfig();
    try {
      detail = await fetchJson<CapabilityDetail>(
        `${config.registry_url}/api/services/${encodeURIComponent(domain)}/capabilities/${encodeURIComponent(capabilityName)}`
      );
    } catch {
      throw new Error(
        `Cannot fetch details for '${capabilityName}' on ${domain}. ` +
        `The service's detail_url (${detailUrl}) is unreachable, ` +
        `and the registry has no stored details for this capability.`
      );
    }
  }

  // Store in both caches
  memCapabilityCache.set(cacheKey, { result: detail, at: Date.now() });
  setCachedCapability(domain, capabilityName, detail);

  return detail;
}

// ─── Guide (from registry, 1h cache) ────────────────────────────

export async function fetchGuide(domain: string): Promise<ServiceGuide | null> {
  // Check in-memory cache (populated by fetchManifest or previous fetchGuide call)
  const mem = memGuideCache.get(domain);
  if (mem && Date.now() - mem.at < CACHE_TTLS.manifest) {
    return mem.result;
  }

  // Fetch from registry
  try {
    const config = loadConfig();
    const reg = await fetchJson<{ success: boolean; data: { setup_guide?: ServiceGuide } }>(
      `${config.registry_url}/api/services/${encodeURIComponent(domain)}`
    );
    const guide = reg.success && reg.data?.setup_guide ? reg.data.setup_guide : null;
    memGuideCache.set(domain, { result: guide, at: Date.now() });
    return guide;
  } catch {
    memGuideCache.set(domain, { result: null, at: Date.now() });
    return null;
  }
}

// ─── Top capabilities scoring ───────────────────────────────────

const TOP_VERBS = ["list", "get", "search", "send", "create"];

function scoreCapability(name: string): number {
  const lower = name.toLowerCase();
  for (let i = 0; i < TOP_VERBS.length; i++) {
    if (lower.endsWith(`_${TOP_VERBS[i]}`) || lower.startsWith(`${TOP_VERBS[i]}_`)) {
      return TOP_VERBS.length - i; // higher score for earlier verbs
    }
  }
  return 0;
}

/**
 * Pick the top N most useful capabilities from a manifest.
 * Prioritizes list/get/search/send/create operations.
 */
export function pickTopCapabilities(
  capabilities: Array<{ name: string; description: string; detail_url: string; resource_group?: string }>,
  n = 3
): string[] {
  return capabilities
    .map((c) => ({ name: c.name, score: scoreCapability(c.name) }))
    .filter((c) => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, n)
    .map((c) => c.name);
}

/**
 * Fetch top capability details for a domain (parallel fetch, best-effort).
 */
export async function fetchTopCapabilityDetails(
  domain: string,
  capNames: string[],
  options?: { force_refresh?: boolean }
): Promise<CapabilityDetail[]> {
  const results = await Promise.allSettled(
    capNames.map((name) => fetchCapabilityDetail(domain, name, options))
  );
  return results
    .filter((r): r is PromiseFulfilledResult<CapabilityDetail> => r.status === "fulfilled")
    .map((r) => r.value);
}

// ─── Cache management ────────────────────────────────────────────

export function clearCache(): void {
  memDiscoveryCache.clear();
  memManifestCache.clear();
  memCapabilityCache.clear();
  memGuideCache.clear();
  clearAllCaches();
}
