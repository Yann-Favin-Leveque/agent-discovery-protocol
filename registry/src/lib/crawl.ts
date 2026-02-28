import { validateManifest, flattenErrors, type Manifest } from "./validate";

export interface CrawlResult {
  success: boolean;
  manifest?: Manifest;
  errors: string[];
  response_time_ms: number;
  detail_url_ok?: boolean;
}

export async function crawlService(domain: string): Promise<CrawlResult> {
  const url = `https://${domain}/.well-known/agent`;
  const start = Date.now();

  // Step 1: Fetch the manifest
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10000),
    });
  } catch (err) {
    return {
      success: false,
      errors: [`Failed to reach ${url}: ${err instanceof Error ? err.message : "Network error"}`],
      response_time_ms: Date.now() - start,
    };
  }

  const response_time_ms = Date.now() - start;

  if (!response.ok) {
    return {
      success: false,
      errors: [`${url} returned HTTP ${response.status} ${response.statusText}`],
      response_time_ms,
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      success: false,
      errors: [`Expected Content-Type application/json, got '${contentType}'`],
      response_time_ms,
    };
  }

  // Step 2: Parse JSON
  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      success: false,
      errors: ["Response body is not valid JSON."],
      response_time_ms,
    };
  }

  // Step 3: Validate manifest
  const validation = validateManifest(data);
  if (!validation.valid || !validation.manifest) {
    return {
      success: false,
      errors: flattenErrors(validation.errors),
      response_time_ms,
    };
  }

  const manifest = validation.manifest;

  // Step 4: Probe the first detail_url to verify it resolves
  let detail_url_ok: boolean | undefined;
  if (manifest.capabilities.length > 0) {
    const firstCap = manifest.capabilities[0];
    const detailUrl = firstCap.detail_url.startsWith("http")
      ? firstCap.detail_url
      : `${manifest.base_url}${firstCap.detail_url}`;

    try {
      const detailRes = await fetch(detailUrl, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });
      detail_url_ok = detailRes.ok;
    } catch {
      detail_url_ok = false;
    }
  }

  return {
    success: true,
    manifest,
    errors: [],
    response_time_ms,
    detail_url_ok,
  };
}

// Keep backward-compatible alias
export const crawlWellKnown = crawlService;
