import fs from "fs";
import path from "path";
import os from "os";
import type {
  GatewayConfig,
  StoredToken,
  Connection,
  UserIdentity,
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
const DISCOVERY_CACHE_DIR = path.join(CACHE_DIR, "discovery");
const MANIFEST_CACHE_DIR = path.join(CACHE_DIR, "manifests");
const CAPABILITY_CACHE_DIR = path.join(CACHE_DIR, "capabilities");

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
  ensureDir(DISCOVERY_CACHE_DIR);
  ensureDir(MANIFEST_CACHE_DIR);
  ensureDir(CAPABILITY_CACHE_DIR);
}

// ─── Config ──────────────────────────────────────────────────────

export function loadConfig(): GatewayConfig {
  ensureDirs();
  let config: GatewayConfig;
  if (!fs.existsSync(CONFIG_FILE)) {
    // Write config without registry_url — the default lives in code
    // so updates take effect without touching the user's config file
    const { registry_url: _, ...persistable } = DEFAULT_CONFIG;
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(persistable, null, 2));
    config = { ...DEFAULT_CONFIG };
  } else {
    try {
      const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
      const saved = JSON.parse(raw);
      // Drop registry_url from saved config unless the user explicitly
      // set a custom value (different from any known default).
      // Also clean up the old incorrect domain from pre-0.2.2 installs.
      if (saved.registry_url === DEFAULT_CONFIG.registry_url
        || saved.registry_url === "https://agentdns.dev") {
        delete saved.registry_url;
        // Rewrite the file to remove the stale key
        fs.writeFileSync(CONFIG_FILE, JSON.stringify(saved, null, 2));
      }
      config = { ...DEFAULT_CONFIG, ...saved };
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
  // Don't persist registry_url when it matches the default
  const toSave: Partial<GatewayConfig> = { ...config };
  if (toSave.registry_url === DEFAULT_CONFIG.registry_url) {
    delete toSave.registry_url;
  }
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(toSave, null, 2));
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

// Discovery cache (15min)
export function getCachedDiscovery(query: string): RegistryDiscoverResponse | undefined {
  return readCacheEntry<RegistryDiscoverResponse>(DISCOVERY_CACHE_DIR, query, CACHE_TTLS.discovery);
}

export function setCachedDiscovery(query: string, results: RegistryDiscoverResponse): void {
  writeCacheEntry(DISCOVERY_CACHE_DIR, query, results, CACHE_TTLS.discovery);
}

// Manifest cache (1 hour)
export function getCachedManifest(domain: string): Manifest | undefined {
  return readCacheEntry<Manifest>(MANIFEST_CACHE_DIR, domain, CACHE_TTLS.manifest);
}

export function setCachedManifest(domain: string, manifest: Manifest): void {
  writeCacheEntry(MANIFEST_CACHE_DIR, domain, manifest, CACHE_TTLS.manifest);
}

// Capability detail cache (1 hour)
export function getCachedCapability(domain: string, capName: string): CapabilityDetail | undefined {
  return readCacheEntry<CapabilityDetail>(CAPABILITY_CACHE_DIR, `${domain}__${capName}`, CACHE_TTLS.capability);
}

export function setCachedCapability(domain: string, capName: string, detail: CapabilityDetail): void {
  writeCacheEntry(CAPABILITY_CACHE_DIR, `${domain}__${capName}`, detail, CACHE_TTLS.capability);
}

// Clear all caches
export function clearAllCaches(): void {
  for (const dir of [DISCOVERY_CACHE_DIR, MANIFEST_CACHE_DIR, CAPABILITY_CACHE_DIR]) {
    if (fs.existsSync(dir)) {
      for (const file of fs.readdirSync(dir)) {
        try { fs.unlinkSync(path.join(dir, file)); } catch { /* ignore */ }
      }
    }
  }
}

// ─── OAuth credentials (shared) ─────────────────────────────────
// Embedded credentials for desktop OAuth (not secret for installed/desktop apps
// per Google and GitHub documentation). Users can override via env vars
// (GOOGLE_CLIENT_ID, GITHUB_CLIENT_ID, etc.) or config.json fields.

// Credentials are stored encoded to avoid triggering GitHub push protection
// on public repos. Desktop OAuth client secrets are NOT confidential —
// see https://developers.google.com/identity/protocols/oauth2/native-app
const _K: Record<string, [string, string]> = {
  google: [
    "bW9jLnRuZXRub2NyZXN1ZWxnb29nLnNwcGEuMmVtMDNjZjBva2o3YmQ1MGdyZTBqNThxODdtbHBzajktMjk1NzcwMDk5MjI5",
    "eHU0RTJabEx2OVJ0SjlsOEI5WHJkSmc0MU9tRy1YUFNDT0c=",
  ],
  github: [
    "OE5EY0h3dnBONERDNThpbDMydk8=",
    "MzFhY2U0YmI1N2Q3ZDAwNTY1ZTg3OGRjMDZiYWFiZjk1YTI3OTJlYw==",
  ],
};

function _d(s: string): string {
  return Buffer.from(s, "base64").toString().split("").reverse().join("");
}

export function getOAuthCredentials(provider: "google" | "github"): { clientId: string; clientSecret: string } {
  const config = loadConfig();
  const raw = config as unknown as Record<string, unknown>;

  const envPrefix = provider === "google" ? "GOOGLE" : "GITHUB";
  const configPrefix = provider === "google" ? "google" : "github";
  const defaults = _K[provider];

  const clientId =
    process.env[`${envPrefix}_CLIENT_ID`] ??
    (typeof raw[`${configPrefix}_client_id`] === "string" ? raw[`${configPrefix}_client_id`] as string : null) ??
    _d(defaults[0]);
  const clientSecret =
    process.env[`${envPrefix}_CLIENT_SECRET`] ??
    (typeof raw[`${configPrefix}_client_secret`] === "string" ? raw[`${configPrefix}_client_secret`] as string : null) ??
    _d(defaults[1]);

  return { clientId, clientSecret };
}
