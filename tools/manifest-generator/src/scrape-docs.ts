#!/usr/bin/env tsx
/**
 * scrape-docs.ts
 *
 * Fallback generator for APIs without public OpenAPI specs.
 * Uses the Anthropic API to read documentation pages and extract
 * structured API information.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/scrape-docs.ts \
 *     --url https://docs.resend.com/api-reference \
 *     --domain resend.com \
 *     --output ./manifests/resend.com/
 */

import { program } from "commander";
import { join } from "path";
import Anthropic from "@anthropic-ai/sdk";
import type {
  Manifest,
  ManifestAuth,
  ManifestCapability,
  CapabilityDetail,
  CapabilityParameter,
} from "./types.js";
import { writeJson, ensureDir, truncateDescription, toSnakeCase, log } from "./utils.js";

// ---- Entry point (CLI) ----

program
  .requiredOption("--url <url>", "Documentation page URL to scrape")
  .requiredOption("--domain <domain>", "Service domain (e.g. resend.com)")
  .requiredOption("--output <dir>", "Output directory for generated files")
  .parse();

const opts = program.opts<{
  url: string;
  domain: string;
  output: string;
}>();

try {
  const result = await scrapeDocs(opts.url, opts.domain, opts.output);
  if (result.success) {
    log.success(`Generated manifest for ${opts.domain} with ${result.capabilityCount} capabilities`);
  } else {
    log.error(`Failed: ${result.errors.join(", ")}`);
    process.exit(1);
  }
} catch (err) {
  log.error(`Fatal: ${(err as Error).message}`);
  process.exit(1);
}

// ---- Public API ----

export interface ScrapeResult {
  success: boolean;
  manifest?: Manifest;
  capabilities?: CapabilityDetail[];
  capabilityCount: number;
  errors: string[];
}

export async function scrapeDocs(
  url: string,
  domain: string,
  outputDir: string,
): Promise<ScrapeResult> {
  log.info(`Fetching documentation from ${url}...`);

  // Fetch the documentation page
  let docContent: string;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "AgentDiscoveryProtocol-ManifestGenerator/1.0",
        Accept: "text/html, application/json, text/plain",
      },
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) {
      return { success: false, capabilityCount: 0, errors: [`HTTP ${res.status}: ${res.statusText}`] };
    }
    docContent = await res.text();
  } catch (err) {
    return { success: false, capabilityCount: 0, errors: [`Fetch failed: ${(err as Error).message}`] };
  }

  // Strip HTML to get text content (basic)
  const textContent = stripHtml(docContent);

  // Truncate to fit in context window (keep first ~50k chars)
  const truncatedContent = textContent.slice(0, 50_000);

  log.info(`Fetched ${textContent.length} chars, sending to Claude for analysis...`);

  // Use Claude to extract structured API info
  const client = new Anthropic();

  const extractionPrompt = `You are analyzing an API documentation page. Extract structured API information from this documentation.

Documentation URL: ${url}
Domain: ${domain}

Documentation content (may be partial):
---
${truncatedContent}
---

Return a JSON object with this exact structure:
{
  "name": "Service Name (short, e.g. 'Resend')",
  "description": "2-3 sentences describing what this API does, written conversationally for an AI agent",
  "base_url": "https://api.example.com (the base URL for API calls)",
  "auth": {
    "type": "oauth2 | api_key | none",
    "header": "Authorization (for api_key type)",
    "prefix": "Bearer (for api_key type, optional)",
    "authorization_url": "(for oauth2 type)",
    "token_url": "(for oauth2 type)",
    "setup_url": "URL where developers get API keys (optional)"
  },
  "capabilities": [
    {
      "name": "snake_case_name (e.g. send_email)",
      "description": "1-2 sentences for an AI agent, conversational tone",
      "primary_endpoint": "/v1/path",
      "primary_method": "POST",
      "endpoints": [
        {
          "path": "/v1/path",
          "method": "POST",
          "description": "What this endpoint does",
          "parameters": [
            {
              "name": "param_name",
              "type": "string",
              "description": "Human-readable description",
              "required": true,
              "example": "example_value"
            }
          ]
        }
      ]
    }
  ]
}

Rules:
- Group related endpoints into 3-8 capabilities (not one per endpoint)
- Capability names must be snake_case and descriptive (e.g. "send_email" not "post_messages")
- Write descriptions in natural language, not technical jargon
- Include 3-5 most important endpoints per capability
- For parameters, include only the most important ones (max 8 per endpoint)
- Generate sensible example values
- If auth type is unclear, default to api_key with Authorization header

IMPORTANT: Return ONLY valid JSON, no markdown code fences.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 8000,
      messages: [{ role: "user", content: extractionPrompt }],
    });

    const responseText = msg.content[0];
    if (responseText.type !== "text") {
      return { success: false, capabilityCount: 0, errors: ["Claude returned non-text response"] };
    }

    // Parse the JSON response
    const extracted = parseClaudeJson(responseText.text);
    if (!extracted) {
      return { success: false, capabilityCount: 0, errors: ["Failed to parse Claude's JSON response"] };
    }

    // Build the manifest and capability details from the extracted data
    return buildFromExtracted(extracted, domain, outputDir);
  } catch (err) {
    return { success: false, capabilityCount: 0, errors: [`Claude API error: ${(err as Error).message}`] };
  }
}

// ---- Build manifest from Claude's extracted data ----

interface ExtractedData {
  name: string;
  description: string;
  base_url: string;
  auth: {
    type: string;
    header?: string;
    prefix?: string;
    authorization_url?: string;
    token_url?: string;
    setup_url?: string;
  };
  capabilities: Array<{
    name: string;
    description: string;
    primary_endpoint: string;
    primary_method: string;
    endpoints: Array<{
      path: string;
      method: string;
      description: string;
      parameters: Array<{
        name: string;
        type: string;
        description: string;
        required: boolean;
        example: unknown;
      }>;
    }>;
  }>;
}

async function buildFromExtracted(
  data: ExtractedData,
  domain: string,
  outputDir: string,
): Promise<ScrapeResult> {
  const errors: string[] = [];

  // Build auth
  const auth: ManifestAuth = { type: "none" };
  if (data.auth) {
    const authType = data.auth.type as "oauth2" | "api_key" | "none";
    if (authType === "oauth2") {
      auth.type = "oauth2";
      auth.authorization_url = data.auth.authorization_url || "https://auth.example.com/authorize";
      auth.token_url = data.auth.token_url || "https://auth.example.com/token";
    } else if (authType === "api_key") {
      auth.type = "api_key";
      auth.header = data.auth.header || "Authorization";
      auth.prefix = data.auth.prefix || "Bearer";
      if (data.auth.setup_url) auth.setup_url = data.auth.setup_url;
    }
  }

  const baseUrl = (data.base_url || `https://${domain}`).replace(/\/$/, "");

  // Build capabilities
  const capabilities: ManifestCapability[] = [];
  const capabilityDetails: CapabilityDetail[] = [];

  for (const cap of (data.capabilities || []).slice(0, 12)) {
    const capName = toSnakeCase(cap.name);

    let description = cap.description || `Manage ${capName.replace(/_/g, " ")} resources.`;
    if (description.length < 10) {
      description = `Manage ${capName.replace(/_/g, " ")} resources through the ${data.name} API.`;
    }

    capabilities.push({
      name: capName,
      description: truncateDescription(description, 300),
      detail_url: `/capabilities/${capName}`,
    });

    // Build detail from the primary endpoint
    const primaryEp = cap.endpoints?.[0];
    const params: CapabilityParameter[] = (primaryEp?.parameters || []).slice(0, 10).map((p) => ({
      name: p.name,
      type: p.type || "string",
      description: p.description || `The ${p.name} parameter.`,
      required: p.required ?? false,
      example: p.example,
    }));

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (auth.type === "api_key") {
      headers[auth.header || "Authorization"] = `${auth.prefix || "Bearer"} {api_key}`;
    } else if (auth.type === "oauth2") {
      headers["Authorization"] = "Bearer {access_token}";
    }

    const bodyParams: Record<string, unknown> = {};
    for (const p of params.filter((p) => p.required)) {
      bodyParams[p.name] = p.example;
    }

    const method = (primaryEp?.method || cap.primary_method || "GET").toUpperCase();
    const endpoint = primaryEp?.path || cap.primary_endpoint || "/";

    const detail: CapabilityDetail = {
      name: capName,
      description: truncateDescription(description, 300),
      endpoint,
      method,
      parameters: params,
      request_example: {
        method,
        url: `${baseUrl}${endpoint}`,
        headers,
        ...(["POST", "PUT", "PATCH"].includes(method) && Object.keys(bodyParams).length > 0
          ? { body: bodyParams }
          : {}),
      },
      response_example: {
        status: method === "POST" ? 201 : 200,
        body: { success: true, data: bodyParams },
      },
    };

    capabilityDetails.push(detail);
  }

  if (capabilities.length === 0) {
    errors.push("No capabilities extracted from documentation");
    return { success: false, capabilityCount: 0, errors };
  }

  let manifestDescription = data.description || `API for ${data.name}.`;
  if (manifestDescription.length < 20) {
    manifestDescription = `${data.name} provides a REST API for programmatic access. Use it to automate workflows and integrate with other services.`;
  }

  const manifest: Manifest = {
    spec_version: "1.0",
    name: (data.name || domain).slice(0, 100),
    description: truncateDescription(manifestDescription, 500),
    base_url: baseUrl,
    auth,
    capabilities,
  };

  // Write files
  await ensureDir(join(outputDir, "capabilities"));
  await writeJson(join(outputDir, "manifest.json"), manifest);
  for (const detail of capabilityDetails) {
    await writeJson(join(outputDir, "capabilities", `${detail.name}.json`), detail);
  }

  log.success(`Wrote manifest.json + ${capabilityDetails.length} capability files to ${outputDir}`);

  return {
    success: true,
    manifest,
    capabilities: capabilityDetails,
    capabilityCount: capabilityDetails.length,
    errors,
  };
}

// ---- Helpers ----

function stripHtml(html: string): string {
  return html
    // Remove script/style blocks
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    // Convert block elements to newlines
    .replace(/<\/(p|div|h[1-6]|li|tr|br|hr)[^>]*>/gi, "\n")
    .replace(/<(br|hr)[^>]*\/?>/gi, "\n")
    // Remove all remaining tags
    .replace(/<[^>]+>/g, " ")
    // Decode common entities
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    // Clean up whitespace
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n/g, "\n\n")
    .trim();
}

function parseClaudeJson(text: string): ExtractedData | null {
  // Try direct parse
  try {
    return JSON.parse(text);
  } catch {
    // Try extracting from markdown code fences
    const match = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        // fall through
      }
    }
    // Try finding the first { ... } block
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        return null;
      }
    }
    return null;
  }
}
