import fs from "fs";
import path from "path";
import os from "os";

const CONFIG_DIR = path.join(os.homedir(), ".agent-gateway");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const TOKENS_FILE = path.join(CONFIG_DIR, "tokens.json");

export interface GatewayConfig {
  registry_url: string;
  auth_callback_port: number;
}

const DEFAULT_CONFIG: GatewayConfig = {
  registry_url: "https://agentdns.dev",
  auth_callback_port: 9876,
};

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

export function loadConfig(): GatewayConfig {
  ensureDir();
  if (!fs.existsSync(CONFIG_FILE)) {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG, null, 2));
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = fs.readFileSync(CONFIG_FILE, "utf-8");
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

import type { StoredToken, Connection } from "./types.js";

interface TokenStore {
  tokens: Record<string, StoredToken>;
  connections: Record<string, Connection>;
}

function loadTokenStore(): TokenStore {
  ensureDir();
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
  ensureDir();
  fs.writeFileSync(TOKENS_FILE, JSON.stringify(store, null, 2));
}

export function getToken(domain: string): StoredToken | undefined {
  const store = loadTokenStore();
  const token = store.tokens[domain];
  if (!token) return undefined;
  // Check expiry
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
