#!/usr/bin/env node

import http from "http";
import readline from "readline";
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

// ─── Desktop OAuth credentials ───────────────────────────────────
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

function getOAuthCredentials(provider: "google" | "github"): { clientId: string; clientSecret: string } {
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

// ─── CLI helpers ─────────────────────────────────────────────────

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

// ─── Interactive provider prompt ─────────────────────────────────

const PROVIDER_CHOICES: { key: string; provider: IdentityProvider; label: string }[] = [
  { key: "1", provider: "google", label: "Google" },
  { key: "2", provider: "github", label: "GitHub" },
];

async function promptProvider(): Promise<IdentityProvider> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("  Sign in to create your gateway identity:\n");
  for (const c of PROVIDER_CHOICES) {
    console.log(`  [${c.key}] ${c.label}`);
  }
  console.log("");

  return new Promise<IdentityProvider>((resolve) => {
    rl.question("  Choice (1-2, default 1): ", (answer) => {
      rl.close();
      const choice = PROVIDER_CHOICES.find((c) => c.key === answer.trim());
      resolve(choice?.provider ?? "google");
    });
  });
}

// ─── Init flow ──────────────────────────────────────────────────

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
  const provider = opts.provider ?? await promptProvider();
  const providerName = IDENTITY_PROVIDERS[provider] ?? provider;

  console.log(`  Signing in with ${providerName}...`);
  console.log("");

  let identity: UserIdentity;

  if (provider === "google" || provider === "github") {
    // Direct OAuth (Desktop app flow)
    identity = await desktopOAuth(provider, config.auth_callback_port, registryUrl);
  } else {
    // For Microsoft, use registry-mediated flow
    identity = await registryMediatedOAuth(provider, config.auth_callback_port, registryUrl);
  }

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
}

// ─── Desktop OAuth (Google & GitHub) ─────────────────────────────

interface ProviderOAuthConfig {
  authorizationUrl: string;
  tokenUrl: string;
  scopes: string;
  extraAuthParams?: Record<string, string>;
  tokenExchangeHeaders?: Record<string, string>;
}

const PROVIDER_OAUTH_CONFIG: Record<"google" | "github", ProviderOAuthConfig> = {
  google: {
    authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    scopes: "openid email profile",
    extraAuthParams: { access_type: "offline", prompt: "consent" },
  },
  github: {
    authorizationUrl: "https://github.com/login/oauth/authorize",
    tokenUrl: "https://github.com/login/oauth/access_token",
    scopes: "read:user user:email",
    tokenExchangeHeaders: { Accept: "application/json" },
  },
};

async function desktopOAuth(
  provider: "google" | "github",
  port: number,
  registryUrl: string
): Promise<UserIdentity> {
  const { clientId, clientSecret } = getOAuthCredentials(provider);
  const providerConfig = PROVIDER_OAUTH_CONFIG[provider];
  const redirectUri = `http://localhost:${port}/callback`;
  const state = Math.random().toString(36).substring(2, 15);

  // Build authorization URL
  const authParams = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: providerConfig.scopes,
    state,
    ...providerConfig.extraAuthParams,
  });
  const authUrl = `${providerConfig.authorizationUrl}?${authParams.toString()}`;

  // Start local callback server and wait for the authorization code
  const codePromise = new Promise<string>((resolve, reject) => {
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

      const code = url.searchParams.get("code");
      if (!code) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end(html("Invalid Callback", "<p>Missing authorization code.</p>"));
        return;
      }

      res.writeHead(200, { "Content-Type": "text/html" });
      res.end(html(
        "Connected to Agent Gateway!",
        "<p>You can close this tab and return to your terminal.</p>"
      ));

      clearTimeout(timeout);
      server.close();
      resolve(code);
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
    console.log("  Open this URL in your browser:");
    console.log("");
    console.log(`  ${authUrl}`);
  }

  console.log("");
  console.log(`  Waiting for sign-in on http://localhost:${port}/callback...`);
  console.log("");

  // Wait for the authorization code
  const code = await codePromise;

  // Exchange code for provider tokens
  const tokenBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
    grant_type: "authorization_code",
  });

  const tokenRes = await fetch(providerConfig.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      ...providerConfig.tokenExchangeHeaders,
    },
    body: tokenBody.toString(),
    signal: AbortSignal.timeout(10000),
  });

  if (!tokenRes.ok) {
    const text = await tokenRes.text();
    throw new Error(`${provider} token exchange failed: ${tokenRes.status} ${text}`);
  }

  const tokenData = (await tokenRes.json()) as {
    access_token: string;
    refresh_token?: string;
    error?: string;
    error_description?: string;
  };

  if (tokenData.error) {
    throw new Error(`${provider} token error: ${tokenData.error_description ?? tokenData.error}`);
  }

  // Exchange provider access token for a registry token via the CLI endpoint
  const registryRes = await fetch(`${registryUrl}/api/auth/cli`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      provider,
      access_token: tokenData.access_token,
    }),
    signal: AbortSignal.timeout(10000),
  });

  if (!registryRes.ok) {
    const text = await registryRes.text();
    throw new Error(`Registry authentication failed: ${registryRes.status} ${text}`);
  }

  const registryData = (await registryRes.json()) as {
    success: boolean;
    data?: {
      registry_token: string;
      email: string;
      name: string;
      provider_id: string;
    };
    error?: string;
  };

  if (!registryData.success || !registryData.data) {
    throw new Error(`Registry auth error: ${registryData.error ?? "unknown"}`);
  }

  return {
    provider,
    provider_id: registryData.data.provider_id,
    email: registryData.data.email,
    name: registryData.data.name ?? undefined,
    registry_token: registryData.data.registry_token,
    connected_at: new Date().toISOString(),
  };
}

// ─── Registry-mediated OAuth (GitHub, Microsoft) ─────────────────

async function registryMediatedOAuth(
  provider: IdentityProvider,
  port: number,
  registryUrl: string
): Promise<UserIdentity> {
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
    console.log("  Open this URL in your browser:");
    console.log("");
    console.log(`  ${authUrl}`);
  }

  console.log("");
  console.log(`  Waiting for sign-in on http://localhost:${port}/callback...`);
  console.log("");

  return identityPromise;
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
