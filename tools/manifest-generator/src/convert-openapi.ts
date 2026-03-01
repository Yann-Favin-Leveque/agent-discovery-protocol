#!/usr/bin/env tsx
/**
 * convert-openapi.ts
 *
 * Converts an OpenAPI 3.x or Swagger 2.x spec into an Agent Discovery Protocol
 * manifest + capability detail files.
 *
 * Usage:
 *   npx tsx tools/manifest-generator/src/convert-openapi.ts \
 *     --input https://api.stripe.com/openapi.json \
 *     --output ./manifests/stripe.com/ \
 *     --domain stripe.com
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
  OpenAPISpec,
  OpenAPIOperation,
  OpenAPISecurityScheme,
  GoogleDiscoverySpec,
  GoogleDiscoveryResource,
  GoogleDiscoveryMethod,
} from "./types.js";
import {
  loadSpec,
  toSnakeCase,
  truncateDescription,
  mapParamType,
  generateExample,
  writeJson,
  ensureDir,
  log,
} from "./utils.js";

// ---- Entry point (CLI) ----

program
  .requiredOption("--input <path-or-url>", "OpenAPI/Swagger spec file path or URL")
  .requiredOption("--output <dir>", "Output directory for generated files")
  .requiredOption("--domain <domain>", "Service domain (e.g. api.stripe.com)")
  .option("--rewrite", "Use Claude API to rewrite descriptions for LLM clarity", false)
  .parse();

const opts = program.opts<{
  input: string;
  output: string;
  domain: string;
  rewrite: boolean;
}>();

try {
  const result = await convertOpenAPI(opts.input, opts.output, opts.domain, opts.rewrite);
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

export interface ConvertResult {
  success: boolean;
  manifest?: Manifest;
  capabilities?: CapabilityDetail[];
  capabilityCount: number;
  errors: string[];
}

export async function convertOpenAPI(
  input: string,
  outputDir: string,
  domain: string,
  rewriteDescriptions: boolean = false,
): Promise<ConvertResult> {
  log.info(`Loading spec from ${input}...`);
  const rawSpec = await loadSpec(input);

  // Detect spec type
  const spec = rawSpec as Record<string, unknown>;
  if (spec.kind === "discovery#restDescription") {
    log.info("Detected Google Discovery format, converting...");
    return convertGoogleDiscovery(rawSpec as GoogleDiscoverySpec, outputDir, domain, rewriteDescriptions);
  }

  const openapi = normalizeSpec(rawSpec as OpenAPISpec);
  return convertNormalizedSpec(openapi, outputDir, domain, rewriteDescriptions);
}

// ---- Normalize Swagger 2.x → OpenAPI 3.x-like structure ----

function normalizeSpec(spec: OpenAPISpec): OpenAPISpec {
  if (spec.swagger && spec.swagger.startsWith("2")) {
    log.info("Converting Swagger 2.x to OpenAPI 3.x format...");

    // Build base URL from Swagger 2.x fields
    const scheme = spec.schemes?.[0] || "https";
    const host = spec.host || "api.example.com";
    const basePath = spec.basePath || "";
    const baseUrl = `${scheme}://${host}${basePath}`;

    spec.servers = [{ url: baseUrl }];

    // Move securityDefinitions → components.securitySchemes
    if (spec.securityDefinitions) {
      spec.components = spec.components || {};
      spec.components.securitySchemes = spec.securityDefinitions;
    }

    // Normalize inline body parameters to requestBody
    for (const pathObj of Object.values(spec.paths || {})) {
      for (const op of Object.values(pathObj)) {
        if (typeof op !== "object" || !op) continue;
        const operation = op as OpenAPIOperation;
        const bodyParam = operation.parameters?.find((p) => p.in === "body");
        if (bodyParam && !operation.requestBody) {
          operation.requestBody = {
            description: bodyParam.description,
            required: bodyParam.required,
            content: {
              "application/json": {
                schema: bodyParam.schema as unknown as undefined,
                example: bodyParam.example,
              },
            },
          };
          operation.parameters = operation.parameters?.filter((p) => p.in !== "body");
        }
      }
    }
  }
  return spec;
}

// ---- Convert normalized OpenAPI spec ----

async function convertNormalizedSpec(
  spec: OpenAPISpec,
  outputDir: string,
  domain: string,
  rewriteDescriptions: boolean,
): Promise<ConvertResult> {
  const errors: string[] = [];

  // Extract top-level fields
  const name = spec.info.title || domain;
  let description = truncateDescription(spec.info.description || `API for ${name}.`, 500);
  const baseUrl = extractBaseUrl(spec, domain);
  const auth = extractAuth(spec);

  // Group endpoints into capabilities
  const groups = groupEndpoints(spec);
  log.info(`Grouped into ${groups.size} capability groups`);

  if (groups.size === 0) {
    errors.push("No endpoints found in the spec");
    return { success: false, capabilityCount: 0, errors };
  }

  // Rewrite descriptions if requested
  if (rewriteDescriptions) {
    description = await rewriteForLLM(description, `service description for ${name}`);
  }

  // Ensure description meets minimum length (spec requires 20-500 chars)
  if (description.length < 50) {
    description = `${name} provides a REST API for programmatic access to its features. Use it to automate workflows and integrate with other services.`;
  }

  // Build capabilities and details
  const capabilities: ManifestCapability[] = [];
  const capabilityDetails: CapabilityDetail[] = [];

  for (const [groupName, endpoints] of groups) {
    const capName = toSnakeCase(groupName);

    // Pick the 3-5 most important endpoints
    const selected = selectBestEndpoints(endpoints, 5);
    if (selected.length === 0) continue;

    // Build the primary endpoint (most representative one)
    const primary = selected[0];
    let capDescription = buildCapabilityDescription(groupName, selected);

    if (rewriteDescriptions) {
      capDescription = await rewriteForLLM(capDescription, `capability: ${groupName}`);
    }

    if (capDescription.length < 10) {
      capDescription = `Manage ${groupName.replace(/_/g, " ")} resources. Supports creating, reading, updating, and deleting.`;
    }

    capabilities.push({
      name: capName,
      description: capDescription,
      detail_url: `/capabilities/${capName}`,
    });

    // Build detail
    const detail = buildCapabilityDetail(capName, capDescription, primary, selected, baseUrl, auth);
    capabilityDetails.push(detail);
  }

  // Cap at ~12 capabilities max to keep manifests focused
  const finalCapabilities = capabilities.slice(0, 12);
  const finalDetails = capabilityDetails.slice(0, 12);

  const manifest: Manifest = {
    spec_version: "1.0",
    name: name.length > 100 ? name.slice(0, 97) + "..." : name,
    description,
    base_url: baseUrl,
    auth,
    capabilities: finalCapabilities,
  };

  // Write output files
  await ensureDir(join(outputDir, "capabilities"));
  await writeJson(join(outputDir, "manifest.json"), manifest);

  for (const detail of finalDetails) {
    await writeJson(join(outputDir, "capabilities", `${detail.name}.json`), detail);
  }

  log.success(`Wrote manifest.json + ${finalDetails.length} capability files to ${outputDir}`);

  return {
    success: true,
    manifest,
    capabilities: finalDetails,
    capabilityCount: finalDetails.length,
    errors,
  };
}

// ---- Convert Google Discovery format ----

async function convertGoogleDiscovery(
  spec: GoogleDiscoverySpec,
  outputDir: string,
  domain: string,
  rewriteDescriptions: boolean,
): Promise<ConvertResult> {
  const name = spec.title || spec.name;
  let description = truncateDescription(spec.description || `API for ${name}.`, 500);
  const baseUrl = (spec.baseUrl || `${spec.rootUrl}${spec.servicePath}`).replace(/\/$/, "");

  // Extract auth
  const scopes = spec.auth?.oauth2?.scopes ? Object.keys(spec.auth.oauth2.scopes) : [];
  const auth: ManifestAuth = scopes.length > 0
    ? {
        type: "oauth2",
        authorization_url: "https://accounts.google.com/o/oauth2/v2/auth",
        token_url: "https://oauth2.googleapis.com/token",
        scopes: scopes.slice(0, 10),
      }
    : { type: "api_key", header: "Authorization", prefix: "Bearer" };

  // Flatten resources into endpoint groups
  const groups = new Map<string, EndpointInfo[]>();
  flattenGoogleResources("", spec.resources, groups, baseUrl);

  if (rewriteDescriptions) {
    description = await rewriteForLLM(description, `service description for ${name}`);
  }

  if (description.length < 50) {
    description = `${name} provides a REST API for programmatic access to its features. Use it to integrate with Google services.`;
  }

  const capabilities: ManifestCapability[] = [];
  const capabilityDetails: CapabilityDetail[] = [];

  for (const [groupName, endpoints] of groups) {
    const capName = toSnakeCase(groupName);
    const selected = selectBestEndpoints(endpoints, 5);
    if (selected.length === 0) continue;

    let capDescription = buildCapabilityDescription(groupName, selected);
    if (rewriteDescriptions) {
      capDescription = await rewriteForLLM(capDescription, `capability: ${groupName}`);
    }
    if (capDescription.length < 10) {
      capDescription = `Manage ${groupName.replace(/_/g, " ")} resources through the ${name} API.`;
    }

    capabilities.push({
      name: capName,
      description: capDescription,
      detail_url: `/capabilities/${capName}`,
    });

    const detail = buildCapabilityDetail(capName, capDescription, selected[0], selected, baseUrl, auth);
    capabilityDetails.push(detail);
  }

  const finalCapabilities = capabilities.slice(0, 12);
  const finalDetails = capabilityDetails.slice(0, 12);

  const manifest: Manifest = {
    spec_version: "1.0",
    name: name.length > 100 ? name.slice(0, 97) + "..." : name,
    description,
    base_url: baseUrl,
    auth,
    capabilities: finalCapabilities,
  };

  await ensureDir(join(outputDir, "capabilities"));
  await writeJson(join(outputDir, "manifest.json"), manifest);

  for (const detail of finalDetails) {
    await writeJson(join(outputDir, "capabilities", `${detail.name}.json`), detail);
  }

  return {
    success: true,
    manifest,
    capabilities: finalDetails,
    capabilityCount: finalDetails.length,
    errors: [],
  };
}

function flattenGoogleResources(
  prefix: string,
  resources: Record<string, GoogleDiscoveryResource> | undefined,
  groups: Map<string, EndpointInfo[]>,
  baseUrl: string,
): void {
  if (!resources) return;

  for (const [resourceName, resource] of Object.entries(resources)) {
    const groupName = prefix ? `${prefix}_${resourceName}` : resourceName;

    if (resource.methods) {
      const endpoints: EndpointInfo[] = [];
      for (const [, method] of Object.entries(resource.methods)) {
        endpoints.push(googleMethodToEndpoint(method, baseUrl));
      }
      if (endpoints.length > 0) {
        groups.set(groupName, endpoints);
      }
    }

    if (resource.resources) {
      flattenGoogleResources(groupName, resource.resources, groups, baseUrl);
    }
  }
}

function googleMethodToEndpoint(method: GoogleDiscoveryMethod, baseUrl: string): EndpointInfo {
  const params: CapabilityParameter[] = [];
  if (method.parameters) {
    for (const [name, param] of Object.entries(method.parameters)) {
      params.push({
        name,
        type: param.type || "string",
        description: param.description || `The ${name} parameter.`,
        required: param.required || false,
        example: param.default || generateExample(name, param.type || "string"),
      });
    }
  }

  return {
    path: `/${method.path}`,
    method: method.httpMethod,
    summary: method.description || method.id,
    description: method.description || "",
    parameters: params,
    tags: [],
    operationId: method.id,
  };
}

// ---- Endpoint grouping ----

interface EndpointInfo {
  path: string;
  method: string;
  summary: string;
  description: string;
  parameters: CapabilityParameter[];
  requestBody?: unknown;
  responseExample?: unknown;
  tags: string[];
  operationId?: string;
}

function groupEndpoints(spec: OpenAPISpec): Map<string, EndpointInfo[]> {
  const groups = new Map<string, EndpointInfo[]>();
  const httpMethods = new Set(["get", "post", "put", "patch", "delete"]);

  for (const [path, pathItem] of Object.entries(spec.paths || {})) {
    if (!pathItem || typeof pathItem !== "object") continue;

    for (const [method, opRaw] of Object.entries(pathItem)) {
      if (!httpMethods.has(method.toLowerCase())) continue;
      if (!opRaw || typeof opRaw !== "object") continue;
      const op = opRaw as OpenAPIOperation;
      if (op.deprecated) continue;

      try {
        const endpoint = extractEndpointInfo(path, method.toUpperCase(), op);
        const groupKey = determineGroup(endpoint, spec);

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(endpoint);
      } catch {
        // Skip malformed endpoints
      }
    }
  }

  // Merge groups that are too small (< 2 endpoints) into their parent
  const merged = new Map<string, EndpointInfo[]>();
  for (const [key, endpoints] of groups) {
    if (endpoints.length < 2) {
      // Try to find a parent group
      const parentKey = key.split("_").slice(0, -1).join("_");
      if (parentKey && merged.has(parentKey)) {
        merged.get(parentKey)!.push(...endpoints);
        continue;
      }
    }
    if (!merged.has(key)) {
      merged.set(key, []);
    }
    merged.get(key)!.push(...endpoints);
  }

  return merged;
}

function determineGroup(endpoint: EndpointInfo, spec: OpenAPISpec): string {
  // Prefer OpenAPI tags
  if (endpoint.tags.length > 0) {
    return toSnakeCase(endpoint.tags[0]);
  }

  // Fall back to first meaningful path segment
  const segments = endpoint.path.split("/").filter(Boolean);
  // Skip version segments like v1, v2, api
  const meaningful = segments.filter((s) => !/^(v\d+|api|rest)$/i.test(s) && !s.startsWith("{"));
  return toSnakeCase(meaningful[0] || "general");
}

function extractEndpointInfo(path: string, method: string, op: OpenAPIOperation): EndpointInfo {
  const params: CapabilityParameter[] = [];

  // Path/query parameters
  for (const p of op.parameters || []) {
    if (!p || !p.name) continue;
    if (p.in === "header" || p.in === "cookie") continue;
    const paramType = mapParamType(p.schema as Record<string, unknown> | undefined, p.type);
    params.push({
      name: p.name,
      type: paramType,
      description: p.description || `The ${p.name} parameter.`,
      required: p.required || p.in === "path",
      example: p.example ?? p.schema?.example ?? generateExample(p.name, paramType, p.schema as Record<string, unknown> | undefined),
    });
  }

  // Request body
  let requestBody: unknown = undefined;
  if (op.requestBody?.content) {
    const jsonContent = op.requestBody.content["application/json"];
    if (jsonContent) {
      requestBody = jsonContent.example || extractSchemaExample(jsonContent.schema);
      // Extract body parameters from schema properties
      const schema = jsonContent.schema as Record<string, unknown> | undefined;
      if (schema?.properties) {
        const required = (schema.required as string[]) || [];
        for (const [propName, propSchemaRaw] of Object.entries(schema.properties as Record<string, unknown>)) {
          if (!propSchemaRaw || typeof propSchemaRaw !== "object") continue;
          const propSchema = propSchemaRaw as Record<string, unknown>;
          const pType = mapParamType(propSchema);
          params.push({
            name: propName,
            type: pType,
            description: (propSchema.description as string) || `The ${propName} field.`,
            required: required.includes(propName),
            example: propSchema.example || generateExample(propName, pType, propSchema),
          });
        }
      }
    }
  }

  // Response example
  let responseExample: unknown = undefined;
  const successResponse = op.responses?.["200"] || op.responses?.["201"] || op.responses?.["202"];
  if (successResponse?.content?.["application/json"]) {
    responseExample = successResponse.content["application/json"].example ||
      extractSchemaExample(successResponse.content["application/json"].schema);
  }

  return {
    path,
    method,
    summary: op.summary || op.description?.slice(0, 100) || "",
    description: op.description || op.summary || "",
    parameters: params,
    requestBody,
    responseExample,
    tags: op.tags || [],
    operationId: op.operationId,
  };
}

function extractSchemaExample(schema: unknown): unknown {
  if (!schema || typeof schema !== "object") return undefined;
  const s = schema as Record<string, unknown>;
  if (s.example) return s.example;
  return undefined;
}

// ---- Endpoint selection (pick best 3-5 per group) ----

function selectBestEndpoints(endpoints: EndpointInfo[], maxCount: number): EndpointInfo[] {
  // Priority: POST/PUT for actions > GET for reads > PATCH > DELETE
  const methodPriority: Record<string, number> = {
    POST: 4,
    PUT: 3,
    GET: 2,
    PATCH: 1,
    DELETE: 0,
  };

  // Deprioritize endpoints with many path params (too specific)
  const scored = endpoints.map((ep) => {
    const pathParamCount = (ep.path.match(/\{[^}]+\}/g) || []).length;
    const methodScore = methodPriority[ep.method] || 0;
    const hasDescription = ep.summary || ep.description ? 1 : 0;
    return {
      endpoint: ep,
      score: methodScore * 10 + hasDescription * 5 - pathParamCount * 3,
    };
  });

  scored.sort((a, b) => b.score - a.score);

  // Ensure variety: try to include at least one GET and one POST/PUT
  const result: EndpointInfo[] = [];
  const methods = new Set<string>();

  for (const { endpoint } of scored) {
    if (result.length >= maxCount) break;

    // Avoid duplicates by operationId or path+method
    const key = endpoint.operationId || `${endpoint.method}:${endpoint.path}`;
    if (result.some((r) => (r.operationId || `${r.method}:${r.path}`) === key)) continue;

    result.push(endpoint);
    methods.add(endpoint.method);
  }

  return result;
}

// ---- Build capability description ----

function buildCapabilityDescription(groupName: string, endpoints: EndpointInfo[]): string {
  const actions: string[] = [];
  for (const ep of endpoints.slice(0, 5)) {
    if (ep.summary) {
      actions.push(ep.summary.replace(/\.$/, ""));
    }
  }

  const humanName = groupName.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  if (actions.length > 0) {
    const actionList = actions.slice(0, 3).join(", ").toLowerCase();
    return `Manage ${humanName.toLowerCase()} — ${actionList}. Supports standard CRUD operations through the REST API.`;
  }

  return `Manage ${humanName.toLowerCase()} resources. Create, read, update, and delete operations are available.`;
}

// ---- Build capability detail ----

function buildCapabilityDetail(
  name: string,
  description: string,
  primary: EndpointInfo,
  allEndpoints: EndpointInfo[],
  baseUrl: string,
  auth: ManifestAuth,
): CapabilityDetail {
  // Build parameters from the primary endpoint (limit to 10 most important)
  const params = primary.parameters.slice(0, 10);

  // Build request example
  const bodyParams: Record<string, unknown> = {};
  for (const p of params.filter((p) => p.required)) {
    bodyParams[p.name] = p.example;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (auth.type === "oauth2" || (auth.type === "api_key" && auth.header === "Authorization")) {
    headers["Authorization"] = `Bearer {access_token}`;
  } else if (auth.type === "api_key" && auth.header) {
    headers[auth.header] = `${auth.prefix || ""}{api_key}`.trim();
  }

  const requestExample = {
    method: primary.method,
    url: `${baseUrl}${primary.path}`,
    headers,
    ...(["POST", "PUT", "PATCH"].includes(primary.method) && Object.keys(bodyParams).length > 0
      ? { body: bodyParams }
      : {}),
  };

  const responseExample = {
    status: primary.method === "POST" ? 201 : 200,
    body: primary.responseExample || {
      success: true,
      data: bodyParams,
    },
  };

  // Extract auth scopes
  const scopes = auth.type === "oauth2" ? auth.scopes?.slice(0, 5) : undefined;

  return {
    name,
    description,
    endpoint: primary.path,
    method: primary.method,
    parameters: params,
    request_example: requestExample,
    response_example: responseExample,
    ...(scopes ? { auth_scopes: scopes } : {}),
  };
}

// ---- Auth extraction ----

function extractAuth(spec: OpenAPISpec): ManifestAuth {
  const schemes = spec.components?.securitySchemes || spec.securityDefinitions || {};

  for (const [, scheme] of Object.entries(schemes)) {
    if (scheme.type === "oauth2") {
      // OpenAPI 3.x flows
      if (scheme.flows) {
        const flow = scheme.flows.authorizationCode || scheme.flows.implicit || scheme.flows.clientCredentials;
        if (flow) {
          return {
            type: "oauth2",
            authorization_url: flow.authorizationUrl || "https://auth.example.com/authorize",
            token_url: flow.tokenUrl || "https://auth.example.com/token",
            scopes: flow.scopes ? Object.keys(flow.scopes).slice(0, 20) : [],
          };
        }
      }
      // Swagger 2.x
      return {
        type: "oauth2",
        authorization_url: scheme.authorizationUrl || "https://auth.example.com/authorize",
        token_url: scheme.tokenUrl || "https://auth.example.com/token",
        scopes: scheme.scopes ? Object.keys(scheme.scopes).slice(0, 20) : [],
      };
    }

    if (scheme.type === "http" && scheme.scheme === "bearer") {
      return {
        type: "api_key",
        header: "Authorization",
        prefix: "Bearer",
      };
    }

    if (scheme.type === "apiKey") {
      return {
        type: "api_key",
        header: (scheme.in === "header" ? scheme.name : "Authorization") || "Authorization",
        prefix: scheme.in === "header" ? undefined : "Bearer",
      };
    }
  }

  return { type: "none" };
}

// ---- Base URL extraction ----

function extractBaseUrl(spec: OpenAPISpec, domain: string): string {
  if (spec.servers && spec.servers.length > 0) {
    let url = spec.servers[0].url;
    // Handle relative URLs
    if (url.startsWith("/")) {
      url = `https://${domain}${url}`;
    }
    return url.replace(/\/$/, "");
  }
  return `https://${domain}`;
}

// ---- AI description rewriting ----

async function rewriteForLLM(text: string, context: string): Promise<string> {
  try {
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 200,
      messages: [
        {
          role: "user",
          content: `Rewrite this ${context} so it's clear, conversational, and helpful for an AI agent trying to understand what this API does. Keep it to 1-3 sentences. Don't use jargon. Don't start with "This API" — just describe what it does directly.\n\nOriginal:\n${text}\n\nRewritten:`,
        },
      ],
    });
    const result = msg.content[0];
    if (result.type === "text" && result.text.length >= 10) {
      return truncateDescription(result.text, 500);
    }
  } catch (err) {
    log.warn(`Claude API rewrite failed, using original: ${(err as Error).message}`);
  }
  return text;
}
