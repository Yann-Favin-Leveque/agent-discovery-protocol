import http from "http";
import { loadConfig, getToken, storeToken, storeConnection, getOAuthCredentials } from "./config.js";
import { fetchManifest } from "./discovery.js";
import type { StoredToken, Manifest } from "./types.js";

export interface AuthResult {
  success: boolean;
  message: string;
  token?: StoredToken;
}

export async function authenticate(domain: string): Promise<AuthResult> {
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
    return {
      success: false,
      message: [
        `${manifest.name} requires an API key.`,
        auth.setup_url ? `Get your key at: ${auth.setup_url}` : "",
        `Once you have it, the agent should call the auth tool with:`,
        `  domain: "${domain}"`,
        `Then provide the API key when prompted.`,
        ``,
        `Or set the key manually: the header is "${auth.header ?? "Authorization"}"${auth.prefix ? ` with prefix "${auth.prefix}"` : ""}.`,
      ]
        .filter(Boolean)
        .join("\n"),
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
  storeToken(token);
  storeConnection({
    domain,
    service_name: manifest.name,
    auth_type: "api_key",
    token,
    connected_at: new Date().toISOString(),
  });

  return {
    success: true,
    message: `API key stored for ${manifest.name}. Connected.`,
    token,
  };
}

// Fetch OAuth client_id from the registry (for non-Google/GitHub services)
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

// Exchange authorization code or refresh token via the registry proxy
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

async function tryRefreshToken(
  domain: string,
  existing: StoredToken
): Promise<StoredToken | null> {
  try {
    const manifest = await fetchManifest(domain);
    if (manifest.auth.type !== "oauth2" || !manifest.auth.token_url) {
      return null;
    }

    // Try registry proxy first (works for any service with registered OAuth client)
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

    // Fallback: direct exchange with hardcoded Google/GitHub credentials
    const isGoogle = manifest.auth.authorization_url?.includes("google.com") || manifest.auth.authorization_url?.includes("googleapis.com");
    const isGitHub = manifest.auth.authorization_url?.includes("github.com");
    const oauthProvider = isGoogle ? "google" as const : isGitHub ? "github" as const : null;
    const creds = oauthProvider ? getOAuthCredentials(oauthProvider) : null;

    if (!creds) return null;

    const refreshParams: Record<string, string> = {
      grant_type: "refresh_token",
      refresh_token: existing.refresh_token!,
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
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

  // Resolve OAuth credentials — try registry first, then hardcoded fallback
  const isGoogle = auth.authorization_url!.includes("google.com") || auth.authorization_url!.includes("googleapis.com");
  const isGitHub = auth.authorization_url!.includes("github.com");

  let clientId: string | null = null;
  let useRegistryProxy = false;
  let extraAuthParams: Record<string, unknown> | null = null;

  // 1. Try registry for any service
  const registryClient = await fetchRegistryOAuthClient(domain);
  if (registryClient) {
    clientId = registryClient.client_id;
    extraAuthParams = registryClient.extra_params ?? null;
    useRegistryProxy = true;
  }

  // 2. Fallback to hardcoded Google/GitHub credentials
  if (!clientId) {
    const oauthProvider = isGoogle ? "google" : isGitHub ? "github" : null;
    const creds = oauthProvider ? getOAuthCredentials(oauthProvider) : null;
    if (creds) {
      clientId = creds.clientId;
    }
  }

  if (!clientId) {
    return {
      success: false,
      message: `No OAuth credentials available for ${domain}. The service needs an OAuth client registered in the registry.`,
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
  // Apply extra_params from registry (e.g. Reddit's "duration": "permanent")
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
          // Exchange via registry proxy (client_secret stays server-side)
          const result = await registryTokenExchange(domain, {
            code,
            redirect_uri: redirectUri,
          });
          if (!result) throw new Error("Token exchange via registry failed.");
          tokenData = result;
        } else {
          // Direct exchange with hardcoded credentials (Google/GitHub fallback)
          const oauthProvider = isGoogle ? "google" : isGitHub ? "github" : null;
          const creds = oauthProvider ? getOAuthCredentials(oauthProvider) : null;

          const tokenParams: Record<string, string> = {
            grant_type: "authorization_code",
            code,
            redirect_uri: redirectUri,
          };
          if (creds) {
            tokenParams.client_id = creds.clientId;
            tokenParams.client_secret = creds.clientSecret;
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
    return {
      success: true,
      message: `${openMessage}\n\nConnected to ${manifest.name} via OAuth2.`,
      token,
    };
  } catch (err) {
    return {
      success: false,
      message: `${openMessage}\n\nAuth failed: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}
