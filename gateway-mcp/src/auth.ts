import http from "http";
import { loadConfig, getToken, storeToken, storeConnection } from "./config.js";
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

async function tryRefreshToken(
  domain: string,
  existing: StoredToken
): Promise<StoredToken | null> {
  try {
    const manifest = await fetchManifest(domain);
    if (manifest.auth.type !== "oauth2" || !manifest.auth.token_url) {
      return null;
    }

    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: existing.refresh_token!,
    });

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

  const authUrl = new URL(auth.authorization_url);
  authUrl.searchParams.set("response_type", "code");
  authUrl.searchParams.set("redirect_uri", redirectUri);
  authUrl.searchParams.set("state", state);
  if (auth.scopes?.length) {
    authUrl.searchParams.set("scope", auth.scopes.join(" "));
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
        const tokenBody = new URLSearchParams({
          grant_type: "authorization_code",
          code,
          redirect_uri: redirectUri,
        });

        const tokenRes = await fetch(auth.token_url!, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: tokenBody.toString(),
          signal: AbortSignal.timeout(10000),
        });

        if (!tokenRes.ok) {
          throw new Error(`Token exchange failed: HTTP ${tokenRes.status}`);
        }

        const tokenData = (await tokenRes.json()) as {
          access_token: string;
          refresh_token?: string;
          expires_in?: number;
          scope?: string;
        };

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
