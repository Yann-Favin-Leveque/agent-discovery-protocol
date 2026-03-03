#!/usr/bin/env node

import readline from "readline";
import { loadConfig, setRegistryUrl } from "./config.js";
import { fetchManifest } from "./discovery.js";
import {
  getCredential,
  storeCredential,
  removeCredential,
  listCredentials,
} from "./credentials.js";
import type { Manifest } from "./types.js";

// ─── CLI helpers ─────────────────────────────────────────────────

interface InitOptions {
  registry?: string;
}

function parseArgs(): InitOptions {
  const args = process.argv.slice(2);
  const opts: InitOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--registry" && args[i + 1]) {
      opts.registry = args[i + 1];
      i++;
    }
  }

  return opts;
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

function maskValue(value: string): string {
  if (value.length <= 8) return "****";
  return value.substring(0, 4) + "..." + value.substring(value.length - 4);
}

// ─── Main menu ──────────────────────────────────────────────────

async function init(): Promise<void> {
  const opts = parseArgs();

  if (opts.registry) {
    setRegistryUrl(opts.registry);
  }

  const config = loadConfig();
  const registryUrl = config.registry_url;

  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║   Agent Gateway — Service Manager    ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  let running = true;
  while (running) {
    console.log("  [1] Register a service");
    console.log("  [2] List registered services");
    console.log("  [3] Remove a service");
    console.log("  [4] Exit");
    console.log("");

    const choice = await ask(rl, "  Choice (1-4): ");
    console.log("");

    switch (choice) {
      case "1":
        await addService(rl, registryUrl);
        break;
      case "2":
        listServices();
        break;
      case "3":
        await removeService(rl);
        break;
      case "4":
      case "":
        running = false;
        break;
      default:
        console.log("  Invalid choice.\n");
    }
  }

  rl.close();

  console.log("  MCP config for your agent:");
  console.log("");
  printMcpConfig(registryUrl);
}

// ─── Add service ────────────────────────────────────────────────

async function addService(rl: readline.Interface, registryUrl: string): Promise<void> {
  const domain = await ask(rl, "  Service domain (e.g. api.openai.com): ");
  if (!domain) {
    console.log("  Cancelled.\n");
    return;
  }

  // Check if already registered
  const existing = getCredential(domain);
  if (existing) {
    const overwrite = await ask(rl, `  ${domain} is already registered. Overwrite? (y/N): `);
    if (overwrite.toLowerCase() !== "y") {
      console.log("  Cancelled.\n");
      return;
    }
  }

  // Fetch manifest
  console.log(`  Fetching manifest for ${domain}...`);
  let manifest: Manifest;
  try {
    manifest = await fetchManifest(domain);
  } catch (err) {
    console.log(`  Error: Cannot reach ${domain}: ${err instanceof Error ? err.message : "unknown"}`);
    console.log("");
    return;
  }

  console.log(`  Found: ${manifest.name}`);
  console.log(`  Auth type: ${manifest.auth.type}`);
  console.log("");

  if (manifest.auth.type === "none") {
    console.log("  This service requires no authentication. No registration needed.");
    console.log("");
    return;
  }

  if (manifest.auth.type === "api_key") {
    if (manifest.auth.setup_url) {
      console.log(`  Get your API key at: ${manifest.auth.setup_url}`);
      // Try to open browser
      try {
        const open = (await import("open")).default;
        await open(manifest.auth.setup_url);
        console.log("  (Browser opened)");
      } catch {
        // ignore
      }
      console.log("");
    }

    const apiKey = await ask(rl, "  API key: ");
    if (!apiKey) {
      console.log("  Cancelled.\n");
      return;
    }

    storeCredential(domain, {
      type: "api_key",
      api_key: apiKey,
      added_at: new Date().toISOString(),
    });

    console.log(`  API key stored for ${manifest.name}.`);
    console.log("");
    return;
  }

  if (manifest.auth.type === "oauth2") {
    if (manifest.auth.setup_url) {
      console.log(`  Create an OAuth app at: ${manifest.auth.setup_url}`);
      try {
        const open = (await import("open")).default;
        await open(manifest.auth.setup_url);
        console.log("  (Browser opened)");
      } catch {
        // ignore
      }
    } else {
      console.log("  Create an OAuth app in the service's developer portal.");
    }
    console.log(`  Set redirect URI to: http://localhost:${loadConfig().auth_callback_port}/callback`);
    if (manifest.auth.scopes?.length) {
      console.log(`  Required scopes: ${manifest.auth.scopes.join(", ")}`);
    }
    console.log("");

    const clientId = await ask(rl, "  Client ID: ");
    if (!clientId) {
      console.log("  Cancelled.\n");
      return;
    }

    const clientSecret = await ask(rl, "  Client Secret: ");
    if (!clientSecret) {
      console.log("  Cancelled.\n");
      return;
    }

    storeCredential(domain, {
      type: "oauth2",
      client_id: clientId,
      client_secret: clientSecret,
      added_at: new Date().toISOString(),
    });

    console.log(`  OAuth credentials stored for ${manifest.name}.`);
    console.log("");
    return;
  }

  console.log(`  Unknown auth type: ${manifest.auth.type}`);
  console.log("");
}

// ─── List services ──────────────────────────────────────────────

function listServices(): void {
  const creds = listCredentials();
  const domains = Object.keys(creds);

  if (domains.length === 0) {
    console.log("  No registered services.");
    console.log("  Use option [1] to register a service.");
    console.log("");
    return;
  }

  console.log(`  Registered services (${domains.length}):`);
  console.log("");
  for (const domain of domains) {
    const c = creds[domain];
    if (c.type === "api_key") {
      console.log(`    ${domain}  [API Key: ${maskValue(c.api_key)}]`);
    } else if (c.type === "oauth2") {
      console.log(`    ${domain}  [OAuth2: ${maskValue(c.client_id)}]`);
    }
  }
  console.log("");
}

// ─── Remove service ─────────────────────────────────────────────

async function removeService(rl: readline.Interface): Promise<void> {
  const creds = listCredentials();
  const domains = Object.keys(creds);

  if (domains.length === 0) {
    console.log("  No registered services to remove.");
    console.log("");
    return;
  }

  console.log("  Registered services:");
  domains.forEach((d, i) => {
    console.log(`    [${i + 1}] ${d} (${creds[d].type})`);
  });
  console.log("");

  const input = await ask(rl, "  Remove (number or domain): ");
  if (!input) {
    console.log("  Cancelled.\n");
    return;
  }

  let domain: string;
  const idx = parseInt(input, 10);
  if (!isNaN(idx) && idx >= 1 && idx <= domains.length) {
    domain = domains[idx - 1];
  } else {
    domain = input;
  }

  if (removeCredential(domain)) {
    console.log(`  Removed ${domain}.`);
  } else {
    console.log(`  ${domain} not found.`);
  }
  console.log("");
}

// ─── Helpers ────────────────────────────────────────────────────

function printMcpConfig(registryUrl: string): void {
  const config: Record<string, unknown> = {
    mcpServers: {
      gateway: {
        command: "agent-gateway-mcp",
        args: registryUrl !== "https://agent-dns.dev"
          ? ["--registry", registryUrl]
          : [],
      },
    },
  };

  console.log("  " + JSON.stringify(config, null, 2).split("\n").join("\n  "));
  console.log("");
}

init().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
