import http from "http";
import { spawn } from "child_process";
import path from "path";
import { loadConfig, getToken, storeToken, storeConnection } from "./config.js";
import { getCredential, storeCredential } from "./credentials.js";
import { fetchManifest } from "./discovery.js";
import { getGuide } from "./guides.js";
import type { StoredToken, Manifest, ServiceGuide } from "./types.js";

export interface TestResult {
  passed: boolean;
  status_code?: number;
  error_message?: string;
  suggestion?: string;
}

export interface AuthResult {
  success: boolean;
  message: string;
  token?: StoredToken;
  needs_credentials?: boolean;
  setup_instructions?: string;
  guide?: ServiceGuide;
  test_result?: TestResult;
}

// ─── Setup instructions for LLM relay ────────────────────────────

async function buildSetupInstructions(domain: string, manifest: Manifest): Promise<{ text: string; guide?: ServiceGuide }> {
  const guide = await getGuide(domain);

  if (guide) {
    return { text: formatGuideInstructions(domain, guide), guide };
  }

  // Fallback: generic instructions from manifest
  const auth = manifest.auth;
  const lines: string[] = [];

  if (auth.type === "api_key") {
    lines.push(`## Setup: ${manifest.name} (API Key)`);
    lines.push("");
    if (auth.setup_url) {
      lines.push(`1. Go to: ${auth.setup_url}`);
      lines.push("2. Create or copy your API key");
    } else {
      lines.push("1. Visit the service's developer portal and create an API key");
    }
    lines.push(`3. Call the auth tool again with: domain="${domain}" and api_key="<your-key>"`);
    lines.push("");
    lines.push(`Header: ${auth.header ?? "Authorization"}${auth.prefix ? ` (prefix: "${auth.prefix}")` : ""}`);
  } else if (auth.type === "oauth2") {
    lines.push(`## Setup: ${manifest.name} (OAuth2)`);
    lines.push("");
    if (auth.setup_url) {
      lines.push(`1. Go to: ${auth.setup_url}`);
    } else {
      lines.push("1. Go to the service's developer portal / OAuth app settings");
    }
    lines.push("2. Create an OAuth application");
    lines.push("3. Set the redirect URI to: http://localhost:9876/callback");
    if (auth.scopes?.length) {
      lines.push(`4. Required scopes: ${auth.scopes.join(", ")}`);
    }
    lines.push(`${auth.scopes?.length ? "5" : "4"}. Copy the client_id and client_secret`);
    lines.push(`${auth.scopes?.length ? "6" : "5"}. Call the auth tool again with: domain="${domain}", client_id="<id>", client_secret="<secret>"`);
  }

  return { text: lines.join("\n") };
}

function formatGuideInstructions(domain: string, guide: ServiceGuide): string {
  const lines: string[] = [];

  lines.push(`## Setup: ${guide.display_name} (${guide.auth_type})`);
  lines.push("");

  // Steps
  for (let i = 0; i < guide.steps.length; i++) {
    lines.push(`${i + 1}. ${guide.steps[i]}`);
  }
  lines.push("");

  // Credential fields
  lines.push("### Credentials needed:");
  for (const field of guide.credential_fields) {
    const masked = field.secret ? " (secret)" : "";
    const placeholder = field.placeholder ? ` — e.g. ${field.placeholder}` : "";
    lines.push(`  - **${field.label}**${masked}: ${field.description}${placeholder}`);
  }
  lines.push("");

  // How to provide
  if (guide.auth_type === "api_key") {
    lines.push(`Call auth with: domain="${domain}" and api_key="<your-key>"`);
  } else if (guide.auth_type === "oauth2") {
    lines.push(`Call auth with: domain="${domain}", client_id="<id>", client_secret="<secret>"`);
  }

  // Notes
  if (guide.notes.length > 0) {
    lines.push("");
    lines.push("### Notes:");
    for (const note of guide.notes) {
      lines.push(`  - ${note}`);
    }
  }

  // Test endpoint info
  if (guide.test_endpoint) {
    lines.push("");
    lines.push(`After setup, credentials will be tested via ${guide.test_endpoint.method} ${guide.test_endpoint.path}${guide.test_endpoint.description ? ` (${guide.test_endpoint.description})` : ""}`);
  }

  return lines.join("\n");
}

// ─── Credential testing ─────────────────────────────────────────

async function testCredential(
  domain: string,
  guide: ServiceGuide,
  manifest: Manifest,
  token: StoredToken
): Promise<TestResult> {
  if (!guide.test_endpoint) {
    return { passed: true };
  }

  const te = guide.test_endpoint;
  const url = `${manifest.base_url}${te.path}`;

  const headers: Record<string, string> = {
    Accept: "application/json",
  };

  // Inject auth header using same logic as caller.ts
  if (token.access_token !== "none") {
    if (token.type === "api_key") {
      const authHeader = manifest.auth.header ?? "Authorization";
      const prefix = manifest.auth.prefix ?? "Bearer";
      headers[authHeader] = `${prefix} ${token.access_token}`;
    } else {
      headers["Authorization"] = `Bearer ${token.access_token}`;
    }
  }

  try {
    const res = await fetch(url, {
      method: te.method,
      headers,
      signal: AbortSignal.timeout(10000),
    });

    const expectedStatus = te.expected_status;
    const passed = expectedStatus
      ? res.status === expectedStatus
      : res.status >= 200 && res.status < 300;

    if (passed) {
      return { passed: true, status_code: res.status };
    }

    // Failure — provide helpful suggestion
    let suggestion: string;
    if (res.status === 401) {
      suggestion = "The key appears to be invalid or expired. Double-check it and try again.";
    } else if (res.status === 403) {
      suggestion = "The key is valid but lacks required permissions/scopes.";
    } else if (res.status === 429) {
      suggestion = "Rate limited. The credential may be correct — try again later.";
    } else {
      suggestion = `Unexpected status ${res.status}. The credential may still be correct.`;
    }

    return {
      passed: false,
      status_code: res.status,
      error_message: `HTTP ${res.status}`,
      suggestion,
    };
  } catch (err) {
    return {
      passed: false,
      error_message: err instanceof Error ? err.message : "unknown error",
      suggestion: "Service may be temporarily unavailable. Credentials may still be correct.",
    };
  }
}

// ─── Interactive registration (spawn terminal) ──────────────────

async function launchRegistrationTerminal(domain: string): Promise<boolean> {
  // Resolve the init script path relative to this file (same dist/ folder)
  const rawDir = path.dirname(new URL(import.meta.url).pathname);
  // On Windows, pathname starts with /C: — strip the leading slash
  const fixedDir = process.platform === "win32" ? rawDir.replace(/^\/([A-Za-z]:)/, "$1") : rawDir;
  const initScript = path.resolve(fixedDir, "init.js");

  return new Promise<boolean>((resolve) => {
    const platform = process.platform;

    try {
      if (platform === "win32") {
        // Windows: open a new cmd window
        const child = spawn("cmd.exe", ["/c", "start", "Agent Gateway - Register", "node", initScript, "--register", domain], {
          detached: true,
          stdio: "ignore",
          shell: false,
        });
        child.unref();
      } else if (platform === "darwin") {
        // macOS: open a new Terminal.app window
        const script = `tell application "Terminal" to do script "node '${initScript}' --register '${domain}'"`;
        const child = spawn("osascript", ["-e", script], {
          detached: true,
          stdio: "ignore",
        });
        child.unref();
      } else {
        // Linux: try common terminal emulators
        const terminals = ["x-terminal-emulator", "gnome-terminal", "konsole", "xterm"];
        let launched = false;
        for (const term of terminals) {
          try {
            const args = term === "gnome-terminal"
              ? ["--", "node", initScript, "--register", domain]
              : ["-e", `node '${initScript}' --register '${domain}'`];
            const child = spawn(term, args, {
              detached: true,
              stdio: "ignore",
            });
            child.unref();
            launched = true;
            break;
          } catch {
            continue;
          }
        }
        if (!launched) {
          resolve(false);
          return;
        }
      }
    } catch {
      resolve(false);
      return;
    }

    // Poll credentials.json for the new credential to appear
    const timeoutMs = 120_000; // 2 minutes
    const pollIntervalMs = 1_000;
    const startTime = Date.now();

    const poll = setInterval(() => {
      const cred = getCredential(domain);
      if (cred) {
        clearInterval(poll);
        resolve(true);
        return;
      }
      if (Date.now() - startTime > timeoutMs) {
        clearInterval(poll);
        resolve(false);
      }
    }, pollIntervalMs);
  });
}

// ─── Main authenticate flow ──────────────────────────────────────

export async function authenticate(
  domain: string,
  overrideClientId?: string,
  overrideClientSecret?: string
): Promise<AuthResult> {
  // If override credentials passed, store them first
  if (overrideClientId && overrideClientSecret) {
    storeCredential(domain, {
      type: "oauth2",
      client_id: overrideClientId,
      client_secret: overrideClientSecret,
      added_at: new Date().toISOString(),
    });
  }

  // Check existing token
  const existing = getToken(domain);
  if (existing && existing.access_token) {
    return {
      success: true,
      message: `Already connected to ${domain}.`,
      token: existing,
    };
  }

  // If token exists but expired, try refresh
  if (existing && !existing.access_token && existing.refresh_token) {
    const refreshed = await tryRefreshToken(domain, existing);
    if (refreshed) {
      return {
        success: true,
        message: `Token refreshed for ${domain}.`,
        token: refreshed,
      };
    }
  }

  // Fetch manifest to get auth requirements
  let manifest: Manifest;
  try {
    manifest = await fetchManifest(domain);
  } catch (err) {
    return {
      success: false,
      message: `Cannot reach ${domain}: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  const auth = manifest.auth;

  if (auth.type === "none") {
    const token: StoredToken = {
      domain,
      type: "api_key",
      access_token: "none",
    };
    storeToken(token);
    storeConnection({
      domain,
      service_name: manifest.name,
      auth_type: "none",
      token,
      connected_at: new Date().toISOString(),
    });
    return {
      success: true,
      message: `${manifest.name} requires no authentication. Connected.`,
      token,
    };
  }

  if (auth.type === "api_key") {
    // Check credentials.json for a stored API key
    let cred = getCredential(domain);
    if (cred && cred.type === "api_key") {
      return storeApiKey(domain, cred.api_key);
    }

    // No stored key — try interactive terminal registration
    const registered = await launchRegistrationTerminal(domain);
    if (registered) {
      cred = getCredential(domain);
      if (cred && cred.type === "api_key") {
        return storeApiKey(domain, cred.api_key);
      }
    }

    // Fallback: return setup instructions
    const { text: instructions, guide } = await buildSetupInstructions(domain, manifest);
    return {
      success: false,
      needs_credentials: true,
      setup_instructions: instructions,
      guide,
      message: instructions,
    };
  }

  if (auth.type === "oauth2") {
    return startOAuth2Flow(domain, manifest);
  }

  return {
    success: false,
    message: `Unknown auth type: ${auth.type}`,
  };
}

// ─── Store API key ───────────────────────────────────────────────

export async function storeApiKey(
  domain: string,
  apiKey: string
): Promise<AuthResult> {
  let manifest: Manifest;
  try {
    manifest = await fetchManifest(domain);
  } catch (err) {
    return {
      success: false,
      message: `Cannot reach ${domain}: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  const token: StoredToken = {
    domain,
    type: "api_key",
    access_token: apiKey,
  };

  // Dual-write: tokens.json (runtime) + credentials.json (persistent)
  storeToken(token);
  storeCredential(domain, {
    type: "api_key",
    api_key: apiKey,
    added_at: new Date().toISOString(),
  });
  storeConnection({
    domain,
    service_name: manifest.name,
    auth_type: "api_key",
    token,
    connected_at: new Date().toISOString(),
  });

  // Test credential if guide has a test endpoint
  const guide = await getGuide(domain);
  let test_result: TestResult | undefined;
  if (guide?.test_endpoint) {
    test_result = await testCredential(domain, guide, manifest, token);
  }

  const testMsg = test_result
    ? test_result.passed
      ? `\nCredential test: PASSED (${guide!.test_endpoint!.method} ${guide!.test_endpoint!.path} → ${test_result.status_code ?? "OK"})`
      : `\nCredential test: FAILED — ${test_result.error_message}. ${test_result.suggestion ?? ""}`
    : "";

  return {
    success: true,
    message: `API key stored for ${manifest.name}. Connected.${testMsg}`,
    token,
    guide: guide ?? undefined,
    test_result,
  };
}

// ─── Registry proxy helpers ──────────────────────────────────────

async function fetchRegistryOAuthClient(domain: string): Promise<{ client_id: string; redirect_uri?: string; extra_params?: Record<string, unknown> } | null> {
  try {
    const config = loadConfig();
    const res = await fetch(`${config.registry_url}/api/services/${encodeURIComponent(domain)}/oauth-client`, {
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

async function registryTokenExchange(domain: string, params: Record<string, string>): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
} | null> {
  try {
    const config = loadConfig();
    const res = await fetch(`${config.registry_url}/api/services/${encodeURIComponent(domain)}/oauth-token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.success) return null;
    return data.data;
  } catch {
    return null;
  }
}

// ─── Token refresh ───────────────────────────────────────────────

async function tryRefreshToken(
  domain: string,
  existing: StoredToken
): Promise<StoredToken | null> {
  try {
    const manifest = await fetchManifest(domain);
    if (manifest.auth.type !== "oauth2" || !manifest.auth.token_url) {
      return null;
    }

    // 1. Try registry proxy first
    const registryResult = await registryTokenExchange(domain, {
      grant_type: "refresh_token",
      refresh_token: existing.refresh_token!,
    });

    if (registryResult) {
      const token: StoredToken = {
        domain,
        type: "oauth2",
        access_token: registryResult.access_token,
        refresh_token: registryResult.refresh_token ?? existing.refresh_token,
        expires_at: registryResult.expires_in
          ? Date.now() + registryResult.expires_in * 1000
          : undefined,
        scopes: existing.scopes,
      };
      storeToken(token);
      return token;
    }

    // 2. Try local credentials
    const cred = getCredential(domain);
    if (!cred || cred.type !== "oauth2") return null;

    const refreshParams: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token: existing.refresh_token!,
      client_id: cred.client_id,
      client_secret: cred.client_secret,
    };
    const body = new URLSearchParams(refreshParams);

    const res = await fetch(manifest.auth.token_url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return null;

    const data = (await res.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const token: StoredToken = {
      domain,
      type: "oauth2",
      access_token: data.access_token,
      refresh_token: data.refresh_token ?? existing.refresh_token,
      expires_at: data.expires_in
        ? Date.now() + data.expires_in * 1000
        : undefined,
      scopes: existing.scopes,
    };

    storeToken(token);
    return token;
  } catch {
    return null;
  }
}

// ─── OAuth2 flow ─────────────────────────────────────────────────

async function startOAuth2Flow(
  domain: string,
  manifest: Manifest
): Promise<AuthResult> {
  const auth = manifest.auth;
  if (!auth.authorization_url || !auth.token_url) {
    return {
      success: false,
      message: "OAuth2 configuration missing authorization_url or token_url.",
    };
  }

  const config = loadConfig();
  const port = config.auth_callback_port;
  const redirectUri = `http://localhost:${port}/callback`;
  const state = Math.random().toString(36).substring(2);

  const isGoogle = auth.authorization_url!.includes("google.com") || auth.authorization_url!.includes("googleapis.com");

  // Resolve OAuth credentials
  let clientId: string | null = null;
  let clientSecret: string | null = null;
  let useRegistryProxy = false;
  let extraAuthParams: Record<string, unknown> | null = null;

  // 1. Local credentials (user-owned)
  const cred = getCredential(domain);
  if (cred && cred.type === "oauth2") {
    clientId = cred.client_id;
    clientSecret = cred.client_secret;
  }

  // 2. Registry proxy (future paid tier)
  if (!clientId) {
    const registryClient = await fetchRegistryOAuthClient(domain);
    if (registryClient) {
      clientId = registryClient.client_id;
      extraAuthParams = registryClient.extra_params ?? null;
      useRegistryProxy = true;
    }
  }

  // 3. No credentials available — try interactive terminal registration
  if (!clientId) {
    const registered = await launchRegistrationTerminal(domain);
    if (registered) {
      const newCred = getCredential(domain);
      if (newCred && newCred.type === "oauth2") {
        clientId = newCred.client_id;
        clientSecret = newCred.client_secret;
      }
    }
  }

  // 4. Still no credentials — return setup instructions as fallback
  if (!clientId) {
    const { text: instructions, guide } = await buildSetupInstructions(domain, manifest);
    return {
      success: false,
      needs_credentials: true,
      setup_instructions: instructions,
      guide,
      message: instructions,
    };
  }

  // Build authorization URL
  const authUrl = new URL(auth.authorization_url);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  if (isGoogle) {
    authUrl.searchParams.set("access_type", "offline");
    authUrl.searchParams.set("prompt", "consent");
  }
  if (auth.scopes?.length) {
    authUrl.searchParams.set("scope", auth.scopes.join(" "));
  }
  if (extraAuthParams) {
    for (const [key, value] of Object.entries(extraAuthParams)) {
      authUrl.searchParams.set(key, String(value));
    }
  }

  // Start local callback server
  const tokenPromise = new Promise<StoredToken>((resolve, reject) => {
    const timeout = setTimeout(() => {
      server.close();
      reject(new Error("OAuth timeout — no callback received within 120 seconds."));
    }, 120000);

    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", `http://localhost:${port}`);

      if (url.pathname !== "/callback") {
        res.writeHead(404);
        res.end("Not found");
        return;
      }

      const code = url.searchParams.get("code");
      const returnedState = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<html><body><h2>Authorization failed</h2><p>${error}</p><p>You can close this tab.</p></body></html>`);
        clearTimeout(timeout);
        server.close();
        reject(new Error(`OAuth error: ${error}`));
        return;
      }

      if (!code || returnedState !== state) {
        res.writeHead(400, { "Content-Type": "text/html" });
        res.end("<html><body><h2>Invalid callback</h2><p>Missing code or state mismatch.</p></body></html>");
        return;
      }

      // Exchange code for token
      try {
        let tokenData: { access_token: string; refresh_token?: string; expires_in?: number; scope?: string };

        if (useRegistryProxy) {
          const result = await registryTokenExchange(domain, {
            code,
            redirect_uri: redirectUri,
          });
          if (!result) throw new Error("Token exchange via registry failed.");
          tokenData = result;
        } else {
          // Direct exchange with user's own credentials
          const tokenParams: Record<string, string> = {
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
            client_id: clientId!,
          };
          if (clientSecret) {
            tokenParams.client_secret = clientSecret;
          }
          const tokenBody = new URLSearchParams(tokenParams);

          const tokenRes = await fetch(auth.token_url!, {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: tokenBody.toString(),
            signal: AbortSignal.timeout(10000),
          });

          if (!tokenRes.ok) {
            throw new Error(`Token exchange failed: HTTP ${tokenRes.status}`);
          }

          tokenData = (await tokenRes.json()) as typeof tokenData;
        }

        const token: StoredToken = {
          domain,
          type: "oauth2",
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          expires_at: tokenData.expires_in
            ? Date.now() + tokenData.expires_in * 1000
            : undefined,
          scopes: tokenData.scope?.split(" ") ?? auth.scopes,
        };

        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          `<html><body><h2>Connected to ${manifest.name}!</h2><p>You can close this tab and return to your agent.</p></body></html>`
        );

        clearTimeout(timeout);
        server.close();
        resolve(token);
      } catch (err) {
        res.writeHead(500, { "Content-Type": "text/html" });
        res.end(`<html><body><h2>Token exchange failed</h2><p>${err instanceof Error ? err.message : "Unknown error"}</p></body></html>`);
        clearTimeout(timeout);
        server.close();
        reject(err);
      }
    });

    server.listen(port, () => {
      // Server ready
    });
  });

  // Open browser
  try {
    const open = (await import("open")).default;
    await open(authUrl.toString());
  } catch {
    // If open fails, just return the URL
  }

  const openMessage = `Opening browser for authorization...\n\nIf the browser didn't open, visit:\n${authUrl.toString()}\n\nWaiting for callback on http://localhost:${port}/callback...`;

  try {
    const token = await tokenPromise;
    storeToken(token);
    storeConnection({
      domain,
      service_name: manifest.name,
      auth_type: "oauth2",
      token,
      connected_at: new Date().toISOString(),
    });

    // Test credential if guide has a test endpoint
    const guide = await getGuide(domain);
    let test_result: TestResult | undefined;
    if (guide?.test_endpoint) {
      test_result = await testCredential(domain, guide, manifest, token);
    }

    const testMsg = test_result
      ? test_result.passed
        ? `\nCredential test: PASSED (${guide!.test_endpoint!.method} ${guide!.test_endpoint!.path} → ${test_result.status_code ?? "OK"})`
        : `\nCredential test: FAILED — ${test_result.error_message}. ${test_result.suggestion ?? ""}`
      : "";

    return {
      success: true,
      message: `${openMessage}\n\nConnected to ${manifest.name} via OAuth2.${testMsg}`,
      token,
      guide: guide ?? undefined,
      test_result,
    };
  } catch (err) {
    return {
      success: false,
      message: `${openMessage}\n\nAuth failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
