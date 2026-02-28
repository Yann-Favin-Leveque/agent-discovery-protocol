import { loadConfig } from "./config.js";
import type {
  Manifest,
  CapabilityDetail,
  RegistryDiscoverResponse,
} from "./types.js";

// In-memory manifest cache (per session)
const manifestCache = new Map<string, { manifest: Manifest; fetchedAt: number }>();
const detailCache = new Map<string, { detail: CapabilityDetail; fetchedAt: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

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

export async function discoverByQuery(
  query: string
): Promise<RegistryDiscoverResponse> {
  const config = loadConfig();
  const url = `${config.registry_url}/api/discover?q=${encodeURIComponent(query)}`;
  return fetchJson<RegistryDiscoverResponse>(url);
}

export async function fetchManifest(domain: string): Promise<Manifest> {
  const cached = manifestCache.get(domain);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.manifest;
  }

  const url = `https://${domain}/.well-known/agent`;
  const manifest = await fetchJson<Manifest>(url);
  manifestCache.set(domain, { manifest, fetchedAt: Date.now() });
  return manifest;
}

export async function fetchCapabilityDetail(
  domain: string,
  capabilityName: string
): Promise<CapabilityDetail> {
  const cacheKey = `${domain}:${capabilityName}`;
  const cached = detailCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL) {
    return cached.detail;
  }

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
  detailCache.set(cacheKey, { detail, fetchedAt: Date.now() });
  return detail;
}

export function clearCache(): void {
  manifestCache.clear();
  detailCache.clear();
}
