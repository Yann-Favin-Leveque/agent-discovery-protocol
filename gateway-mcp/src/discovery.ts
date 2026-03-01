import {
  loadConfig,
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

// ─── In-memory hot cache (discovery only) ────────────────────────

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

// ─── Manifest (always live) ──────────────────────────────────────

export async function fetchManifest(domain: string): Promise<Manifest> {
  // Try live /.well-known/agent first, fall back to registry
  try {
    return await fetchJson<Manifest>(`https://${domain}/.well-known/agent`);
  } catch {
    // Service doesn't host its own endpoint — fetch from registry
    const config = loadConfig();
    const reg = await fetchJson<{ success: boolean; data: { manifest: Manifest } }>(
      `${config.registry_url}/api/services/${encodeURIComponent(domain)}`
    );
    if (!reg.success || !reg.data?.manifest) {
      throw new Error(
        `Service '${domain}' has no /.well-known/agent endpoint and is not in the registry.`
      );
    }
    return reg.data.manifest;
  }
}

// ─── Capability detail (always live) ─────────────────────────────

export async function fetchCapabilityDetail(
  domain: string,
  capabilityName: string
): Promise<CapabilityDetail> {
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

  return await fetchJson<CapabilityDetail>(detailUrl);
}

// ─── Cache management ────────────────────────────────────────────

export function clearCache(): void {
  memDiscoveryCache.clear();
  clearAllCaches();
}
