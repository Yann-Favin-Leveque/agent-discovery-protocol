// Local HTTP server that backs `agent-gateway config`.
//
// The CLI starts this server on port 9876 (with fallback through 9885),
// opens the user's browser at http://localhost:<port>/, and waits for
// the page to POST /api/shutdown when the user clicks "Done".
//
// Routes:
//   GET    /                          → serves config-page.html
//   GET    /api/identity              → local identity (or {authenticated:false})
//   POST   /api/identity              → store identity returned by OAuth
//   DELETE /api/identity              → sign out (clears identity)
//   GET    /api/connections           → local credentials + connection state
//   POST   /api/connections           → store credential locally
//   DELETE /api/connections/:domain   → remove credential locally
//   GET    /api/registry-url          → expose configured registry URL to the page
//   GET    /oauth-return              → catches the registry's OAuth redirect,
//                                         stores the token, then 302→ /
//   POST   /api/shutdown              → kills the server cleanly

import http from "http";
import fs from "fs";
import path from "path";
import { URL } from "url";
import {
  loadConfig,
  storeIdentity,
  getIdentity,
  clearIdentity,
  getConnection,
} from "./config.js";
import {
  listCredentials,
  storeCredential,
  removeCredential,
  getCredential,
} from "./credentials.js";
import type { UserCredential, UserIdentity } from "./types.js";

// ─── Port selection ─────────────────────────────────────────────

const PORT_RANGE_START = 9876;
const PORT_RANGE_END = 9885;

async function tryListen(server: http.Server, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const onError = (err: NodeJS.ErrnoException) => {
      server.removeListener("listening", onListening);
      if (err.code === "EADDRINUSE") {
        resolve(false);
      } else {
        // Unrelated error — propagate via reject-equivalent (false + log).
        // We don't throw here; the caller will move on to the next port.
        // A real connectivity failure surfaces when *every* port fails.
        resolve(false);
      }
    };
    const onListening = () => {
      server.removeListener("error", onError);
      resolve(true);
    };
    server.once("error", onError);
    server.once("listening", onListening);
    server.listen(port, "127.0.0.1");
  });
}

// ─── Static page resolution ─────────────────────────────────────
//
// The HTML file ships alongside the compiled JS. We resolve it from
// the same directory as this module (works in both dev `tsx` runs
// and production `node dist/...`).
function resolveStaticPath(): string {
  const here = new URL(import.meta.url).pathname;
  // Windows fix: file:///C:/... → /C:/...
  const fixed = process.platform === "win32" ? here.replace(/^\/([A-Za-z]:)/, "$1") : here;
  const dir = path.dirname(fixed);
  // Try dist/config-page.html first (production), fall back to src/.
  const distPath = path.join(dir, "config-page.html");
  if (fs.existsSync(distPath)) return distPath;
  const srcPath = path.resolve(dir, "..", "src", "config-page.html");
  return srcPath;
}

// ─── Helpers ────────────────────────────────────────────────────

function jsonResponse(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(body));
}

async function readBody(req: http.IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(chunk as Buffer);
  }
  if (chunks.length === 0) return undefined;
  const raw = Buffer.concat(chunks).toString("utf-8");
  if (!raw.trim()) return undefined;
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error("Invalid JSON body");
  }
}

function isLocalRequest(req: http.IncomingMessage): boolean {
  const remote = req.socket.remoteAddress ?? "";
  return (
    remote === "127.0.0.1" ||
    remote === "::1" ||
    remote === "::ffff:127.0.0.1"
  );
}

// ─── Server start ───────────────────────────────────────────────

export interface ConfigServerHandle {
  port: number;
  url: string;
  done: Promise<void>;
  close: () => void;
}

export async function startConfigServer(): Promise<ConfigServerHandle> {
  let donePromiseResolve: () => void = () => {};
  const done = new Promise<void>((resolve) => {
    donePromiseResolve = resolve;
  });

  const server = http.createServer(async (req, res) => {
    try {
      // Only accept connections from this machine — defense-in-depth
      // against accidentally exposing local secrets to the network.
      if (!isLocalRequest(req)) {
        res.writeHead(403);
        res.end("forbidden");
        return;
      }

      const urlObj = new URL(req.url ?? "/", `http://localhost:${PORT_RANGE_START}`);
      const pathname = urlObj.pathname;
      const method = (req.method ?? "GET").toUpperCase();

      // ── Static: the page ─────────────────────────────────────
      if (method === "GET" && (pathname === "/" || pathname === "/index.html")) {
        const file = resolveStaticPath();
        if (!fs.existsSync(file)) {
          res.writeHead(500, { "Content-Type": "text/plain" });
          res.end("config-page.html missing — run `npm run build` in gateway-mcp first.");
          return;
        }
        const html = fs.readFileSync(file, "utf-8");
        res.writeHead(200, {
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": "no-store",
        });
        res.end(html);
        return;
      }

      // ── OAuth return from the registry ───────────────────────
      // The page redirects the user to:
      //   <registry>/api/auth/google?return_to=http://localhost:<port>/oauth-return
      // The registry's OAuth callback eventually 302s back here with
      //   ?token=<registry_token>&email=<email>&name=<name>&provider=<p>&provider_id=<id>
      // We persist the identity locally and send the user back to /.
      if (method === "GET" && pathname === "/oauth-return") {
        const token = urlObj.searchParams.get("token");
        const email = urlObj.searchParams.get("email");
        const provider = (urlObj.searchParams.get("provider") ?? "google") as UserIdentity["provider"];
        const providerId = urlObj.searchParams.get("provider_id") ?? "";
        const name = urlObj.searchParams.get("name") ?? undefined;

        if (token && email) {
          const identity: UserIdentity = {
            provider,
            provider_id: providerId,
            email,
            name,
            registry_token: token,
            connected_at: new Date().toISOString(),
          };
          storeIdentity(identity);
        }

        res.writeHead(302, { Location: "/" });
        res.end();
        return;
      }

      // ── /api/registry-url ────────────────────────────────────
      if (method === "GET" && pathname === "/api/registry-url") {
        const cfg = loadConfig();
        jsonResponse(res, 200, { success: true, data: { registry_url: cfg.registry_url } });
        return;
      }

      // ── /api/identity ────────────────────────────────────────
      if (pathname === "/api/identity") {
        if (method === "GET") {
          const id = getIdentity();
          if (!id) {
            jsonResponse(res, 200, { success: true, data: { authenticated: false } });
            return;
          }
          // Don't ship the token to the page — the page asks the local
          // server to make registry calls on its behalf via /api/proxy/*.
          jsonResponse(res, 200, {
            success: true,
            data: {
              authenticated: true,
              email: id.email,
              name: id.name,
              provider: id.provider,
              connected_at: id.connected_at,
            },
          });
          return;
        }
        if (method === "POST") {
          const body = (await readBody(req)) as Partial<UserIdentity> | undefined;
          if (!body || !body.registry_token || !body.email) {
            jsonResponse(res, 400, { success: false, error: "registry_token and email required" });
            return;
          }
          const identity: UserIdentity = {
            provider: body.provider ?? "google",
            provider_id: body.provider_id ?? "",
            email: body.email,
            name: body.name,
            avatar_url: body.avatar_url,
            registry_token: body.registry_token,
            registry_refresh_token: body.registry_refresh_token,
            connected_at: body.connected_at ?? new Date().toISOString(),
          };
          storeIdentity(identity);
          jsonResponse(res, 200, { success: true });
          return;
        }
        if (method === "DELETE") {
          clearIdentity();
          jsonResponse(res, 200, { success: true });
          return;
        }
      }

      // ── /api/connections ─────────────────────────────────────
      if (pathname === "/api/connections" && method === "GET") {
        const creds = listCredentials();
        const data: Record<string, unknown> = {};
        for (const [domain, c] of Object.entries(creds)) {
          const conn = getConnection(domain);
          data[domain] = {
            type: c.type,
            added_at: c.added_at,
            connection: conn
              ? {
                  service_name: conn.service_name,
                  auth_type: conn.auth_type,
                  connected_at: conn.connected_at,
                  call_count: conn.call_count ?? 0,
                  last_called_at: conn.last_called_at,
                }
              : null,
          };
        }
        jsonResponse(res, 200, { success: true, data });
        return;
      }

      if (pathname === "/api/connections" && method === "POST") {
        const body = (await readBody(req)) as
          | { domain: string; credential: UserCredential }
          | undefined;
        if (!body || !body.domain || !body.credential) {
          jsonResponse(res, 400, { success: false, error: "domain and credential required" });
          return;
        }
        // Stamp added_at server-side so callers don't have to.
        const cred: UserCredential = {
          ...body.credential,
          added_at: body.credential.added_at ?? new Date().toISOString(),
        } as UserCredential;
        storeCredential(body.domain, cred);
        jsonResponse(res, 200, { success: true });
        return;
      }

      // /api/connections/:domain
      const connMatch = /^\/api\/connections\/([^/]+)$/.exec(pathname);
      if (connMatch) {
        const domain = decodeURIComponent(connMatch[1]);
        if (method === "GET") {
          const cred = getCredential(domain);
          jsonResponse(res, 200, { success: true, data: cred ?? null });
          return;
        }
        if (method === "DELETE") {
          const removed = removeCredential(domain);
          jsonResponse(res, 200, { success: true, data: { removed } });
          return;
        }
      }

      // ── /api/proxy/enablement ────────────────────────────────
      // Server-side proxy to the registry so the browser doesn't need
      // to handle the user's JWT directly.
      if (pathname === "/api/proxy/enablement") {
        const id = getIdentity();
        if (!id) {
          jsonResponse(res, 401, { success: false, error: "Not signed in" });
          return;
        }
        const cfg = loadConfig();
        const upstream = `${cfg.registry_url}/api/users/me/enablement`;
        const headers: Record<string, string> = {
          Authorization: `Bearer ${id.registry_token}`,
          "Content-Type": "application/json",
        };
        try {
          if (method === "GET") {
            const upstreamRes = await fetch(upstream, { headers });
            const text = await upstreamRes.text();
            res.writeHead(upstreamRes.status, {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            });
            res.end(text);
            return;
          }
          if (method === "POST") {
            const body = await readBody(req);
            const upstreamRes = await fetch(upstream, {
              method: "POST",
              headers,
              body: JSON.stringify(body ?? {}),
            });
            const text = await upstreamRes.text();
            res.writeHead(upstreamRes.status, {
              "Content-Type": "application/json",
              "Cache-Control": "no-store",
            });
            res.end(text);
            return;
          }
        } catch (err) {
          jsonResponse(res, 502, {
            success: false,
            error: `Cannot reach registry: ${err instanceof Error ? err.message : "unknown"}`,
          });
          return;
        }
      }

      // ── /api/proxy/setup-intent ─────────────────────────────
      // POST → registry POST /api/users/payment-method (creates SetupIntent).
      if (pathname === "/api/proxy/setup-intent" && method === "POST") {
        const id = getIdentity();
        if (!id) {
          jsonResponse(res, 401, { success: false, error: "Not signed in" });
          return;
        }
        const cfg = loadConfig();
        try {
          const upstream = `${cfg.registry_url}/api/users/payment-method`;
          const upstreamRes = await fetch(upstream, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${id.registry_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });
          const text = await upstreamRes.text();
          res.writeHead(upstreamRes.status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(text);
          return;
        } catch (err) {
          jsonResponse(res, 502, {
            success: false,
            error: `Cannot reach registry: ${err instanceof Error ? err.message : "unknown"}`,
          });
          return;
        }
      }

      // ── /api/proxy/payment-method-confirm ────────────────────
      // PUT-equivalent on registry: marks payment_method_added=true.
      if (pathname === "/api/proxy/payment-method-confirm" && method === "POST") {
        const id = getIdentity();
        if (!id) {
          jsonResponse(res, 401, { success: false, error: "Not signed in" });
          return;
        }
        const cfg = loadConfig();
        try {
          const upstream = `${cfg.registry_url}/api/users/payment-method`;
          const upstreamRes = await fetch(upstream, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${id.registry_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });
          const text = await upstreamRes.text();
          res.writeHead(upstreamRes.status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(text);
          return;
        } catch (err) {
          jsonResponse(res, 502, {
            success: false,
            error: `Cannot reach registry: ${err instanceof Error ? err.message : "unknown"}`,
          });
          return;
        }
      }

      // ── /api/proxy/billing-portal ────────────────────────────
      if (pathname === "/api/proxy/billing-portal" && method === "POST") {
        const id = getIdentity();
        if (!id) {
          jsonResponse(res, 401, { success: false, error: "Not signed in" });
          return;
        }
        const cfg = loadConfig();
        try {
          const upstream = `${cfg.registry_url}/api/users/me/billing-portal`;
          const upstreamRes = await fetch(upstream, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${id.registry_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({}),
          });
          const text = await upstreamRes.text();
          res.writeHead(upstreamRes.status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(text);
          return;
        } catch (err) {
          jsonResponse(res, 502, {
            success: false,
            error: `Cannot reach registry: ${err instanceof Error ? err.message : "unknown"}`,
          });
          return;
        }
      }

      // /api/proxy/enablement/:domain (DELETE)
      const enablementDeleteMatch = /^\/api\/proxy\/enablement\/([^/]+)$/.exec(pathname);
      if (enablementDeleteMatch && method === "DELETE") {
        const id = getIdentity();
        if (!id) {
          jsonResponse(res, 401, { success: false, error: "Not signed in" });
          return;
        }
        const cfg = loadConfig();
        const domain = decodeURIComponent(enablementDeleteMatch[1]);
        try {
          const upstream = `${cfg.registry_url}/api/users/me/enablement/${encodeURIComponent(domain)}`;
          const upstreamRes = await fetch(upstream, {
            method: "DELETE",
            headers: { Authorization: `Bearer ${id.registry_token}` },
          });
          const text = await upstreamRes.text();
          res.writeHead(upstreamRes.status, {
            "Content-Type": "application/json",
            "Cache-Control": "no-store",
          });
          res.end(text);
          return;
        } catch (err) {
          jsonResponse(res, 502, {
            success: false,
            error: `Cannot reach registry: ${err instanceof Error ? err.message : "unknown"}`,
          });
          return;
        }
      }

      // ── /api/shutdown ────────────────────────────────────────
      if (pathname === "/api/shutdown" && method === "POST") {
        jsonResponse(res, 200, { success: true });
        // Defer close so the response actually flushes.
        setTimeout(() => {
          server.close(() => {
            donePromiseResolve();
          });
        }, 100);
        return;
      }

      // ── 404 ──────────────────────────────────────────────────
      jsonResponse(res, 404, { success: false, error: `Not found: ${method} ${pathname}` });
    } catch (err) {
      jsonResponse(res, 500, {
        success: false,
        error: err instanceof Error ? err.message : "Server error",
      });
    }
  });

  // Try ports in range until one binds.
  let chosenPort = -1;
  for (let p = PORT_RANGE_START; p <= PORT_RANGE_END; p++) {
    const ok = await tryListen(server, p);
    if (ok) {
      chosenPort = p;
      break;
    }
  }
  if (chosenPort === -1) {
    throw new Error(
      `Could not bind to any port in ${PORT_RANGE_START}-${PORT_RANGE_END}. ` +
        "Close any other instances of `agent-gateway config` and try again."
    );
  }

  return {
    port: chosenPort,
    url: `http://localhost:${chosenPort}`,
    done,
    close: () => {
      server.close(() => donePromiseResolve());
    },
  };
}
