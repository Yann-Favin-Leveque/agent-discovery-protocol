import { fetchManifest, fetchCapabilityDetail } from "./discovery.js";
import { authenticate, storeApiKey } from "./auth.js";
import { getToken } from "./config.js";
import type { CapabilityDetail, Manifest } from "./types.js";

export interface CallResult {
  success: boolean;
  status?: number;
  data?: unknown;
  error?: string;
  auth_required?: boolean;
}

export async function callCapability(
  domain: string,
  capabilityName: string,
  params: Record<string, unknown>,
  apiKey?: string
): Promise<CallResult> {
  // Step 1: Ensure we have a token
  let token = getToken(domain);
  if (!token || !token.access_token) {
    // If caller provided an API key, store it
    if (apiKey) {
      const authResult = await storeApiKey(domain, apiKey);
      if (!authResult.success) {
        return { success: false, error: authResult.message, auth_required: true };
      }
      token = authResult.token;
    } else {
      // Try to authenticate
      const authResult = await authenticate(domain);
      if (!authResult.success) {
        return { success: false, error: authResult.message, auth_required: true };
      }
      token = authResult.token;
    }
  }

  if (!token) {
    return { success: false, error: "No authentication token available.", auth_required: true };
  }

  // Step 2: Fetch capability detail
  let detail: CapabilityDetail;
  let manifest: Manifest;
  try {
    manifest = await fetchManifest(domain);
    detail = await fetchCapabilityDetail(domain, capabilityName);
  } catch (err) {
    return {
      success: false,
      error: `Failed to fetch capability detail: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }

  // Step 3: Build the request — classify parameters by location
  let endpoint = detail.endpoint.startsWith("http")
    ? detail.endpoint
    : `${manifest.base_url}${detail.endpoint}`;

  const method = detail.method.toUpperCase();

  // Detect path param names from {paramName} patterns in endpoint
  const endpointPathParams = new Set<string>();
  for (const match of endpoint.matchAll(/\{(\w+)\}/g)) {
    endpointPathParams.add(match[1]);
  }

  // Build a lookup of explicit "in" values from capability detail
  const paramMeta = new Map<string, string>();
  for (const p of detail.parameters ?? []) {
    if (p.in) paramMeta.set(p.name, p.in);
  }

  // Classify each param: use explicit "in" if present, otherwise infer
  const pathValues: Record<string, unknown> = {};
  const queryValues: Record<string, unknown> = {};
  const bodyValues: Record<string, unknown> = {};
  const headerValues: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(params)) {
    const explicit = paramMeta.get(key);
    if (explicit === "path" || (!explicit && endpointPathParams.has(key))) {
      pathValues[key] = value;
    } else if (explicit === "header") {
      headerValues[key] = value;
    } else if (explicit === "query") {
      queryValues[key] = value;
    } else if (explicit === "body") {
      bodyValues[key] = value;
    } else {
      // No explicit "in" and not a path param — infer from HTTP method
      if (method === "GET" || method === "HEAD" || method === "DELETE") {
        queryValues[key] = value;
      } else {
        bodyValues[key] = value;
      }
    }
  }

  // Substitute path parameters in the endpoint URL
  endpoint = endpoint.replace(/\{(\w+)\}/g, (_match, paramName) => {
    if (pathValues[paramName] !== undefined) {
      return encodeURIComponent(String(pathValues[paramName]));
    }
    return `{${paramName}}`;
  });

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  // Inject auth
  if (token.access_token !== "none") {
    if (token.type === "api_key") {
      const authHeader = manifest.auth.header ?? "Authorization";
      const prefix = manifest.auth.prefix ?? "Bearer";
      headers[authHeader] = `${prefix} ${token.access_token}`;
    } else {
      headers["Authorization"] = `Bearer ${token.access_token}`;
    }
  }

  // Inject header parameters
  for (const [key, value] of Object.entries(headerValues)) {
    headers[key] = String(value);
  }

  // Step 4: Make the call
  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(30000),
  };

  if (method !== "GET" && method !== "HEAD" && Object.keys(bodyValues).length > 0) {
    fetchOpts.body = JSON.stringify(bodyValues);
  }

  // Append query parameters
  let finalUrl = endpoint;
  if (Object.keys(queryValues).length > 0) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(queryValues)) {
      qs.set(key, String(value));
    }
    finalUrl = `${endpoint}?${qs.toString()}`;
  }

  try {
    const res = await fetch(finalUrl, fetchOpts);
    let body: unknown;
    const contentType = res.headers.get("content-type") ?? "";
    if (contentType.includes("application/json")) {
      body = await res.json();
    } else {
      body = await res.text();
    }

    if (!res.ok) {
      return {
        success: false,
        status: res.status,
        data: body,
        error: `Service returned HTTP ${res.status}`,
      };
    }

    return {
      success: true,
      status: res.status,
      data: body,
    };
  } catch (err) {
    return {
      success: false,
      error: `Request failed: ${err instanceof Error ? err.message : "unknown"}`,
    };
  }
}
