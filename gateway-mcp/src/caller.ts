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

  // Step 3: Build the request
  const url = detail.endpoint.startsWith("http")
    ? detail.endpoint
    : `${manifest.base_url}${detail.endpoint}`;

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

  // Step 4: Make the call
  const method = detail.method.toUpperCase();
  const fetchOpts: RequestInit = {
    method,
    headers,
    signal: AbortSignal.timeout(30000),
  };

  if (method !== "GET" && method !== "HEAD") {
    fetchOpts.body = JSON.stringify(params);
  }

  // For GET, append params as query string
  let finalUrl = url;
  if (method === "GET" && Object.keys(params).length > 0) {
    const qs = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      qs.set(key, String(value));
    }
    finalUrl = `${url}?${qs.toString()}`;
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
