#!/usr/bin/env node

import readline from "readline";
import { loadConfig, setRegistryUrl } from "./config.js";
import { fetchManifest } from "./discovery.js";
import { getCredential, storeCredential } from "./credentials.js";
import type { Manifest } from "./types.js";
import { startConfigServer } from "./config-server.js";

// ─── CLI helpers ─────────────────────────────────────────────────

type Command = "config" | "init" | "register-only";

interface InitOptions {
  command: Command;
  registry?: string;
  register?: string; // --register <domain>: skip menu, register a single service
}

function parseArgs(): InitOptions {
  const args = process.argv.slice(2);
  const opts: InitOptions = { command: "config" };

  // First positional arg is the subcommand. Everything else is flags.
  // Backwards-compat: no subcommand → default to `config`.
  let i = 0;
  if (args.length > 0 && !args[0].startsWith("-")) {
    const sub = args[0];
    if (sub === "init" || sub === "config") {
      opts.command = sub;
      i = 1;
    }
  }

  for (; i < args.length; i++) {
    if (args[i] === "--registry" && args[i + 1]) {
      opts.registry = args[i + 1];
      i++;
    } else if (args[i] === "--register" && args[i + 1]) {
      opts.register = args[i + 1];
      opts.command = "register-only";
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

// ─── Main dispatch ──────────────────────────────────────────────

async function main(): Promise<void> {
  const opts = parseArgs();

  if (opts.registry) {
    setRegistryUrl(opts.registry);
  }

  const config = loadConfig();
  const registryUrl = config.registry_url;

  if (opts.command === "register-only" && opts.register) {
    await runRegisterOnly(registryUrl, opts.register);
    return;
  }

  // `init` is now an alias of `config`. The text-only flow has been
  // replaced by the local web page.
  if (opts.command === "init") {
    console.log("  `agent-gateway init` is now `agent-gateway config` (same flow).");
  }

  await runConfig();
}

// ─── Run config (local web page) ────────────────────────────────

async function runConfig(): Promise<void> {
  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║         AgentDNS — Setup             ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");
  console.log("  Starting local config server...");

  let handle;
  try {
    handle = await startConfigServer();
  } catch (err) {
    console.error(`  Failed to start config server: ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  console.log(`  Server running at ${handle.url}`);
  console.log("  Opening browser...");
  console.log("");
  console.log("  When you're done, click 'Done' in the page or press Ctrl+C here.");
  console.log("");

  // Open the browser. If this fails (headless / WSL), fall back to printing.
  try {
    const open = (await import("open")).default;
    await open(handle.url);
  } catch {
    console.log(`  Could not open browser automatically. Visit: ${handle.url}`);
  }

  // Allow Ctrl+C to close the server cleanly.
  const onSig = () => {
    console.log("\n  Shutting down...");
    handle.close();
  };
  process.on("SIGINT", onSig);
  process.on("SIGTERM", onSig);

  await handle.done;
  console.log("  Done.");
}

// ─── Register-only mode (used by spawned terminal) ──────────────

async function runRegisterOnly(registryUrl: string, domain: string): Promise<void> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║   Agent Gateway — Register Service   ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");

  await addService(rl, registryUrl, domain);
  rl.close();
}

// ─── Add service ────────────────────────────────────────────────

async function addService(rl: readline.Interface, registryUrl: string, domainOverride?: string): Promise<void> {
  const domain = domainOverride ?? await ask(rl, "  Service domain (e.g. api.openai.com): ");
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

main().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
