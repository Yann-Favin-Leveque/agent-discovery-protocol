import {
  loadConfig,
  getCachedManifest,
  setCachedManifest,
  getCachedDetail,
  setCachedDetail,
  getCachedDiscovery,
  setCachedDiscovery,
  clearAllCaches,
} from "./config.js";
import type {
  Manifest,
  CapabilityDetail,
  RegistryDiscoverResponse,
} from "./types.js";
import { CACHE_TTLS } from "./types.js";

// ─── In-memory hot cache (backed by disk) ────────────────────────

const memManifestCache = new Map<string, { manifest: Manifest; at: number }>();
const memDetailCache = new Map<string, { detail: CapabilityDetail; at: number }>();
const memDiscoveryCache = new Map<string, { result: RegistryDiscoverResponse; at: number }>();

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
  options?: { include_unverified?: boolean }
): Promise<RegistryDiscoverResponse> {
  const cacheKey = options?.include_unverified ? `${query}:unverified` : query;

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

// ─── Manifest (24h cache) ────────────────────────────────────────

export async function fetchManifest(domain: string): Promise<Manifest> {
  // Check in-memory hot cache
  const mem = memManifestCache.get(domain);
  if (mem && Date.now() - mem.at < CACHE_TTLS.manifest) {
    return mem.manifest;
  }

  // Check disk cache
  const disk = getCachedManifest(domain);
  if (disk) {
    memManifestCache.set(domain, { manifest: disk, at: Date.now() });
    return disk;
  }

  // Fetch live
  const url = `https://${domain}/.well-known/agent`;
  const manifest = await fetchJson<Manifest>(url);

  // Store in both caches
  memManifestCache.set(domain, { manifest, at: Date.now() });
  setCachedManifest(domain, manifest);

  return manifest;
}

// ─── Capability detail (1h cache) ────────────────────────────────

export async function fetchCapabilityDetail(
  domain: string,
  capabilityName: string
): Promise<CapabilityDetail> {
  const cacheKey = `${domain}:${capabilityName}`;

  // Check in-memory hot cache
  const mem = memDetailCache.get(cacheKey);
  if (mem && Date.now() - mem.at < CACHE_TTLS.capability) {
    return mem.detail;
  }

  // Check disk cache
  const disk = getCachedDetail(domain, capabilityName);
  if (disk) {
    memDetailCache.set(cacheKey, { detail: disk, at: Date.now() });
    return disk;
  }

  // Fetch live
  const manifest = await fetchManifest(domain);
  const cap = manifest.capabilities.find((c) => c.name === capabilityName);
  if (!cap) {
    throw new Error(
      `Capability '${capabilityName}' not found on ${domain}. Available: ${manifest.capabilities.map((c) => c.name).join(", ")}`
    );
  }

  const detailUrl = cap.detail_url.startsWith("http")
    ? cap.detail_url
    : `${manifest.base_url}${cap.detail_url}`;

  const detail = await fetchJson<CapabilityDetail>(detailUrl);

  // Store in both caches
  memDetailCache.set(cacheKey, { detail, at: Date.now() });
  setCachedDetail(domain, capabilityName, detail);

  return detail;
}

// ─── Cache management ────────────────────────────────────────────

export function clearCache(): void {
  memManifestCache.clear();
  memDetailCache.clear();
  memDiscoveryCache.clear();
  clearAllCaches();
}
