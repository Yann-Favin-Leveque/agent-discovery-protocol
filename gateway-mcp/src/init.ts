#!/usr/bin/env node

import http from "http";
import {
  loadConfig,
  saveConfig,
  storeIdentity,
  isInitialized,
  getIdentity,
  syncTokensFromCloud,
  setRegistryUrl,
} from "./config.js";
import type { UserIdentity, IdentityProvider } from "./types.js";

const IDENTITY_PROVIDERS: Record<IdentityProvider, string> = {
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
};

interface InitOptions {
  registry?: string;
  provider?: IdentityProvider;
}

function parseArgs(): InitOptions {
  const args = process.argv.slice(2);
  const opts: InitOptions = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--registry" && args[i + 1]) {
      opts.registry = args[i + 1];
      i++;
    }
    if (args[i] === "--provider" && args[i + 1]) {
      opts.provider = args[i + 1] as IdentityProvider;
      i++;
    }
  }

  return opts;
}

async function init(): Promise<void> {
  const opts = parseArgs();

  if (opts.registry) {
    setRegistryUrl(opts.registry);
  }

  const config = loadConfig();
  const registryUrl = config.registry_url;

  console.log("");
  console.log("  ╔══════════════════════════════════════╗");
  console.log("  ║     Agent Gateway — Setup            ║");
  console.log("  ╚══════════════════════════════════════╝");
  console.log("");

  if (isInitialized()) {
    const identity = getIdentity()!;
    console.log(`  Already signed in as ${identity.email} (${identity.provider})`);
    console.log("");

    // Sync connections
    console.log("  Syncing connections from cloud...");
    const sync = await syncTokensFromCloud();
    if (sync.success) {
      console.log(`  Synced ${sync.count} new connection(s).`);
    } else {
      console.log(`  Sync skipped: ${sync.error}`);
    }

    console.log("");
    console.log("  You're all set! Your agent can now use the gateway.");
    console.log("");
    printMcpConfig(registryUrl);
    return;
  }

  // Determine provider
  const provider = opts.provider ?? "google";
  const providerName = IDENTITY_PROVIDERS[provider] ?? provider;

  console.log(`  Signing in with ${providerName}...`);
  console.log("");

  // Start OAuth flow with registry
  const port = config.auth_callback_port;
  const redirectUri = `http://localhost:${port}/callback`;
  const state = Math.random().toString(36).substring(2, 15);

  const authUrl = `${registryUrl}/auth/init?provider=${provider}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;

  // Start local callback server
  const identityPromise = new Promise<UserIdentity>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("Authentication timeout — no callback received within 120 seconds."));
    }, 120000);

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const error = url.searchParams.get("error");
      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(html("Authentication Failed", `<p>${error}</p><p>You can close this tab.</p>`));
        clearTimeout(timeout);
        server.close();
        reject(new Error(`Auth error: ${error}`));
        return;
      }

      const returnedState = url.searchParams.get("state");
      if (returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(html("Invalid Callback", "<p>State mismatch. Please try again.</p>"));
        return;
      }

      // Registry returns identity data in the callback
      const registryToken = url.searchParams.get("token");
      const refreshToken = url.searchParams.get("refresh_token");
      const email = url.searchParams.get("email");
      const name = url.searchParams.get("name");
      const providerId = url.searchParams.get("provider_id");

      if (!registryToken || !email || !providerId) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(html("Invalid Callback", "<p>Missing authentication data. Please try again.</p>"));
        return;
      }

      const identity: UserIdentity = {
        provider,
        provider_id: providerId,
        email,
        name: name ?? undefined,
        registry_token: registryToken,
        registry_refresh_token: refreshToken ?? undefined,
        connected_at: new Date().toISOString(),
      };

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html(
        "Connected to Agent Gateway!",
        `<p>Signed in as <strong>${email}</strong></p><p>You can close this tab and return to your terminal.</p>`
      ));

      clearTimeout(timeout);
      server.close();
      resolve(identity);
    });

    server.listen(port, () => {
      // Server ready
    });
  });

  // Open browser
  try {
    const open = (await import("open")).default;
    await open(authUrl);
    console.log("  Browser opened for sign-in.");
  } catch {
    console.log(`  Open this URL in your browser:`);
    console.log("");
    console.log(`  ${authUrl}`);
  }

  console.log("");
  console.log(`  Waiting for sign-in on http://localhost:${port}/callback...`);
  console.log("");

  try {
    const identity = await identityPromise;
    storeIdentity(identity);

    console.log(`  Signed in as ${identity.email}`);
    console.log("");

    // Sync existing connections from cloud
    console.log("  Syncing connections from cloud...");
    const sync = await syncTokensFromCloud();
    if (sync.success) {
      if (sync.count > 0) {
        console.log(`  Restored ${sync.count} connection(s) from your account.`);
      } else {
        console.log("  No existing connections found. Start fresh!");
      }
    } else {
      console.log("  Cloud sync skipped (will retry on next run).");
    }

    console.log("");
    console.log("  Setup complete! Add this to your MCP client config:");
    console.log("");
    printMcpConfig(registryUrl);
  } catch (err) {
    console.error(`  Setup failed: ${err instanceof Error ? err.message : "unknown error"}`);
    process.exit(1);
  }
}

function printMcpConfig(registryUrl: string): void {
  const config: Record<string, unknown> = {
    mcpServers: {
      gateway: {
        command: "agent-gateway-mcp",
        args: registryUrl !== "https://agentdns.dev"
          ? ["--registry", registryUrl]
          : [],
      },
    },
  };

  console.log("  " + JSON.stringify(config, null, 2).split("\n").join("\n  "));
  console.log("");
}

function html(title: string, body: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #0a0a0a; color: #e5e5e5; }
    .card { text-align: center; padding: 3rem; border: 1px solid #262626; border-radius: 12px; background: #171717; max-width: 400px; }
    h2 { color: #10b981; margin-bottom: 1rem; }
    p { color: #a3a3a3; line-height: 1.6; }
    strong { color: #e5e5e5; }
  </style>
</head>
<body>
  <div class="card">
    <h2>${title}</h2>
    ${body}
  </div>
</body>
</html>`;
}

init().catch((err) => {
  console.error(`Fatal error: ${err}`);
  process.exit(1);
});
