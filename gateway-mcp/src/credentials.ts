import fs from "fs";
import path from "path";
import os from "os";
import type { UserCredential, CredentialStore } from "./types.js";

// Redeclare CONFIG_DIR to avoid circular dependency with config.ts
const CONFIG_DIR = path.join(os.homedir(), ".agent-gateway");
const CREDENTIALS_FILE = path.join(CONFIG_DIR, "credentials.json");

function ensureDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function loadStore(): CredentialStore {
  ensureDir();
  if (!fs.existsSync(CREDENTIALS_FILE)) {
    return { version: 1, credentials: {} };
  }
  try {
    const raw = fs.readFileSync(CREDENTIALS_FILE, "utf-8");
    return JSON.parse(raw) as CredentialStore;
  } catch {
    return { version: 1, credentials: {} };
  }
}

function saveStore(store: CredentialStore): void {
  ensureDir();
  fs.writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), {
    mode: 0o600,
  });
}

export function getCredential(domain: string): UserCredential | undefined {
  const store = loadStore();
  return store.credentials[domain];
}

export function storeCredential(domain: string, cred: UserCredential): void {
  const store = loadStore();
  store.credentials[domain] = cred;
  saveStore(store);
}

export function removeCredential(domain: string): boolean {
  const store = loadStore();
  if (!(domain in store.credentials)) return false;
  delete store.credentials[domain];
  saveStore(store);
  return true;
}

export function listCredentials(): Record<string, UserCredential> {
  const store = loadStore();
  return { ...store.credentials };
}
