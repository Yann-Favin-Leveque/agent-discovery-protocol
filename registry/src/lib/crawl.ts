import { validateManifest, type Manifest, type ValidationResult } from "./validate";

export interface CrawlResult {
  success: boolean;
  manifest?: Manifest;
  errors: string[];
}

export async function crawlWellKnown(domain: string): Promise<CrawlResult> {
  const url = `https://${domain}/.well-known/agent`;

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
    };
  }

  if (!response.ok) {
    return {
      success: false,
      errors: [`${url} returned HTTP ${response.status} ${response.statusText}`],
    };
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    return {
      success: false,
      errors: [`Expected Content-Type application/json, got '${contentType}'`],
    };
  }

  let data: unknown;
  try {
    data = await response.json();
  } catch {
    return {
      success: false,
      errors: ["Response body is not valid JSON."],
    };
  }

  const validation: ValidationResult = validateManifest(data);
  if (!validation.valid) {
    return {
      success: false,
      errors: validation.errors,
    };
  }

  return {
    success: true,
    manifest: validation.manifest,
    errors: [],
  };
}
