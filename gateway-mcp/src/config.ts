import fs from "fs";
import path from "path";
import os from "os";
import type {
  GatewayConfig,
  StoredToken,
  Connection,
  UserIdentity,
  CloudSyncState,
  CloudTokenBundle,
  CacheEntry,
  Manifest,
  CapabilityDetail,
  RegistryDiscoverResponse,
} from "./types.js";
import { CACHE_TTLS } from "./types.js";

// ─── Paths ───────────────────────────────────────────────────────

const CONFIG_DIR = path.join(os.homedir(), ".agent-gateway");
const CACHE_DIR = path.join(CONFIG_DIR, "cache");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const TOKENS_FILE = path.join(CONFIG_DIR, "tokens.json");
const MANIFEST_CACHE_DIR = path.join(CACHE_DIR, "manifests");
const DETAIL_CACHE_DIR = path.join(CACHE_DIR, "details");
const DISCOVERY_CACHE_DIR = path.join(CACHE_DIR, "discovery");

const DEFAULT_CONFIG: GatewayConfig = {
  registry_url: "https://agent-dns.dev",
  auth_callback_port: 9876,
};

// Override from CLI args
let registryUrlOverride: string | undefined;

export function setRegistryUrl(url: string): void {
  registryUrlOverride = url;
}

// ─── Directory setup ─────────────────────────────────────────────

function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function ensureDirs(): void {
  ensureDir(CONFIG_DIR);
  ensureDir(CACHE_DIR);
  ensureDir(MANIFEST_CACHE_DIR);
  ensureDir(DETAIL_CACHE_DIR);
  ensureDir(DISCOVERY_CACHE_DIR);
}

// ─── Config ──────────────────────────────────────────────────────

export function loadConfig(): GatewayConfig {
  ensureDirs();
  let config: GatewayConfig;
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    config = { ...DEFAULT_CONFIG };
  } else {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      config = { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
    } catch {
      config = { ...DEFAULT_CONFIG };
    }
  }
  if (registryUrlOverride) {
    config.registry_url = registryUrlOverride;
  }
  return config;
}

export function saveConfig(config: GatewayConfig): void {
  ensureDirs();
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}

// ─── Identity ────────────────────────────────────────────────────

export function getIdentity(): UserIdentity | undefined {
  const config = loadConfig();
  return config.identity;
}

export function storeIdentity(identity: UserIdentity): void {
  const config = loadConfig();
  config.identity = identity;
  saveConfig(config);
}

export function clearIdentity(): void {
  const config = loadConfig();
  delete config.identity;
  delete config.cloud_sync;
  saveConfig(config);
}

export function isInitialized(): boolean {
  const config = loadConfig();
  return !!config.identity;
}

// ─── Token store ─────────────────────────────────────────────────

interface TokenStore {
  tokens: Record<string, StoredToken>;
  connections: Record<string, Connection>;
}

function loadTokenStore(): TokenStore {
  ensureDirs();
  if (!fs.existsSync(TOKENS_FILE)) {
    return { tokens: {}, connections: {} };
  }
  try {
    const raw = fs.readFileSync(TOKENS_FILE, "utf-8");
    return JSON.parse(raw);
  } catch {
    return { tokens: {}, connections: {} };
  }
}

function saveTokenStore(store: TokenStore): void {
  ensureDirs();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(store, null, 2));
}

export function getToken(domain: string): StoredToken | undefined {
  const store = loadTokenStore();
  const token = store.tokens[domain];
  if (!token) return undefined;
  if (token.expires_at && Date.now() > token.expires_at) {
    return { ...token, access_token: "" }; // Mark as expired
  }
  return token;
}

export function storeToken(token: StoredToken): void {
  const store = loadTokenStore();
  store.tokens[token.domain] = token;
  saveTokenStore(store);
}

export function removeToken(domain: string): void {
  const store = loadTokenStore();
  delete store.tokens[domain];
  delete store.connections[domain];
  saveTokenStore(store);
}

export function getConnection(domain: string): Connection | undefined {
  const store = loadTokenStore();
  return store.connections[domain];
}

export function storeConnection(connection: Connection): void {
  const store = loadTokenStore();
  store.connections[connection.domain] = connection;
  saveTokenStore(store);
}

export function getAllConnections(): Connection[] {
  const store = loadTokenStore();
  return Object.values(store.connections);
}

export function getAllTokens(): StoredToken[] {
  const store = loadTokenStore();
  return Object.values(store.tokens);
}

// ─── Cloud sync ──────────────────────────────────────────────────

export async function syncTokensToCloud(): Promise<{ success: boolean; error?: string }> {
  const config = loadConfig();
  if (!config.identity) {
    return { success: false, error: "Not signed in. Run `agent-gateway init` first." };
  }

  const store = loadTokenStore();
  const bundle: CloudTokenBundle = {
    tokens: store.tokens,
    connections: store.connections,
    synced_at: new Date().toISOString(),
  };

  try {
    const res = await fetch(`${config.registry_url}/api/gateway/sync`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.identity.registry_token}`,
      },
      body: JSON.stringify(bundle),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { success: false, error: `Sync failed: HTTP ${res.status}` };
    }

    // Update sync state
    config.cloud_sync = {
      last_synced_at: bundle.synced_at,
    };
    saveConfig(config);
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: `Sync failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

export async function syncTokensFromCloud(): Promise<{ success: boolean; count: number; error?: string }> {
  const config = loadConfig();
  if (!config.identity) {
    return { success: false, count: 0, error: "Not signed in. Run `agent-gateway init` first." };
  }

  try {
    const res = await fetch(`${config.registry_url}/api/gateway/sync`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${config.identity.registry_token}`,
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) {
      return { success: false, count: 0, error: `Sync failed: HTTP ${res.status}` };
    }

    const bundle = (await res.json()) as CloudTokenBundle;
    const store = loadTokenStore();

    // Merge: cloud data wins for any conflicts
    let count = 0;
    for (const [domain, token] of Object.entries(bundle.tokens)) {
      if (!store.tokens[domain]) count++;
      store.tokens[domain] = token;
    }
    for (const [domain, conn] of Object.entries(bundle.connections)) {
      store.connections[domain] = conn;
    }

    saveTokenStore(store);

    config.cloud_sync = {
      last_synced_at: bundle.synced_at,
    };
    saveConfig(config);

    return { success: true, count };
  } catch (err) {
    return {
      success: false,
      count: 0,
      error: `Sync failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}

// ─── Disk cache ──────────────────────────────────────────────────

function safeName(key: string): string {
  return key.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function readCacheEntry<T>(dir: string, key: string, ttl: number): T | undefined {
  const filePath = path.join(dir, `${safeName(key)}.json`);
  if (!fs.existsSync(filePath)) return undefined;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.cached_at > ttl) {
      // Expired — delete and return undefined
      try { fs.unlinkSync(filePath); } catch { /* ignore */ }
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

function writeCacheEntry<T>(dir: string, key: string, data: T, ttl: number): void {
  ensureDir(dir);
  const filePath = path.join(dir, `${safeName(key)}.json`);
  const entry: CacheEntry<T> = { data, cached_at: Date.now(), ttl };
  try {
    fs.writeFileSync(filePath, JSON.stringify(entry));
  } catch { /* ignore write failures */ }
}

// Manifest cache (24h)
export function getCachedManifest(domain: string): Manifest | undefined {
  return readCacheEntry<Manifest>(MANIFEST_CACHE_DIR, domain, CACHE_TTLS.manifest);
}

export function setCachedManifest(domain: string, manifest: Manifest): void {
  writeCacheEntry(MANIFEST_CACHE_DIR, domain, manifest, CACHE_TTLS.manifest);
}

// Capability detail cache (1h)
export function getCachedDetail(domain: string, capability: string): CapabilityDetail | undefined {
  const key = `${domain}__${capability}`;
  return readCacheEntry<CapabilityDetail>(DETAIL_CACHE_DIR, key, CACHE_TTLS.capability);
}

export function setCachedDetail(domain: string, capability: string, detail: CapabilityDetail): void {
  const key = `${domain}__${capability}`;
  writeCacheEntry(DETAIL_CACHE_DIR, key, detail, CACHE_TTLS.capability);
}

// Discovery cache (15min)
export function getCachedDiscovery(query: string): RegistryDiscoverResponse | undefined {
  return readCacheEntry<RegistryDiscoverResponse>(DISCOVERY_CACHE_DIR, query, CACHE_TTLS.discovery);
}

export function setCachedDiscovery(query: string, results: RegistryDiscoverResponse): void {
  writeCacheEntry(DISCOVERY_CACHE_DIR, query, results, CACHE_TTLS.discovery);
}

// Clear all caches
export function clearAllCaches(): void {
  for (const dir of [MANIFEST_CACHE_DIR, DETAIL_CACHE_DIR, DISCOVERY_CACHE_DIR]) {
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        try { fs.unlinkSync(path.join(dir, file)); } catch { /* ignore */ }
      }
    }
  }
}
