/**
 * agent-well-known-next
 *
 * Next.js App Router helpers for the Agent Discovery Protocol.
 * Generates the two route handlers every service needs:
 *
 *   GET /.well-known/agent                          - the service manifest
 *   GET /.well-known/agent/capabilities/[name]      - capability detail
 *
 * Spec: https://github.com/user/agent-discovery-protocol/tree/main/spec
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Parameter definition for a capability. */
export interface ParameterConfig {
  /** Parameter name. */
  name: string;
  /** Type: string, number, boolean, object, string[], object[]. */
  type: string;
  /** Whether this parameter is required. */
  required: boolean;
  /** Human-readable description. */
  description: string;
  /** Example value used in auto-generated request examples. */
  example?: unknown;
  /** Where the parameter is sent: path, query, body, or header. */
  in?: "path" | "query" | "body" | "header";
}

/** Authentication configuration. */
export interface AuthConfig {
  /** Auth mechanism: oauth2, api_key, or none. */
  type: "oauth2" | "api_key" | "none";
  /** OAuth2 authorization URL. Required when type is oauth2. */
  authorization_url?: string;
  /** OAuth2 token URL. Required when type is oauth2. */
  token_url?: string;
  /** OAuth2 scopes. */
  scopes?: string[];
  /** Header name for API key auth. Defaults to "Authorization". */
  header?: string;
  /** Prefix before the key value (e.g. "Bearer"). */
  prefix?: string;
  /** URL where users can create/manage their API keys. */
  setup_url?: string;
}

/** Pricing plan. */
export interface PricingPlan {
  name: string;
  price: string;
  limits: string;
}

/** Pricing configuration (optional). */
export interface PricingConfig {
  /** Pricing model: free, freemium, or paid. */
  type: "free" | "freemium" | "paid";
  /** Available plans. */
  plans?: PricingPlan[];
  /** URL to the full pricing page. */
  plans_url?: string;
}

/** Rate limit configuration for a capability. */
export interface RateLimitConfig {
  requests_per_minute?: number;
  daily_limit?: number;
}

/** Individual capability configuration. */
export interface CapabilityConfig {
  /** Machine-readable identifier (snake_case). */
  name: string;
  /** 1-2 sentence description for LLM understanding. */
  description: string;
  /** API path relative to base_url. */
  endpoint: string;
  /** HTTP method: GET, POST, PUT, PATCH, DELETE. */
  method: string;
  /** Parameter definitions. */
  parameters: ParameterConfig[];
  /** Explicit request example. Auto-generated if omitted. */
  request_example?: RequestExample;
  /** Example response. */
  response_example?: ResponseExample;
  /** Auth scopes required for this capability. */
  auth_scopes?: string[];
  /** Rate limits for this capability. */
  rate_limits?: RateLimitConfig;
  /** Logical resource group for organizing related capabilities (e.g. "messages", "users"). */
  resource_group?: string;
}

/** Shape of an auto-generated or user-provided request example. */
export interface RequestExample {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: unknown;
}

/** Shape of a response example. */
export interface ResponseExample {
  status: number;
  body: unknown;
}

/** Full service configuration passed by the user. */
export interface AgentConfig {
  /** Human-readable service name. */
  name: string;
  /** 2-3 sentences describing the service, written for an LLM. */
  description: string;
  /** Base URL for all API calls. */
  base_url: string;
  /** Authentication configuration. */
  auth: AuthConfig;
  /** Pricing information (optional). */
  pricing?: PricingConfig;
  /** List of capabilities the service exposes. */
  capabilities: CapabilityConfig[];
}

// ---------------------------------------------------------------------------
// Internal: Manifest shape (what gets served at /.well-known/agent)
// ---------------------------------------------------------------------------

interface ManifestCapability {
  name: string;
  description: string;
  detail_url: string;
  resource_group?: string;
}

interface Manifest {
  spec_version: string;
  name: string;
  description: string;
  base_url: string;
  auth: AuthConfig;
  pricing?: PricingConfig;
  capabilities: ManifestCapability[];
}

// ---------------------------------------------------------------------------
// Internal: Capability detail shape (what gets served at detail_url)
// ---------------------------------------------------------------------------

interface CapabilityDetail {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    example?: unknown;
    in?: string;
  }>;
  request_example: RequestExample;
  response_example?: ResponseExample;
  auth_scopes?: string[];
  rate_limits?: RateLimitConfig;
  resource_group?: string;
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const VALID_AUTH_TYPES = ["oauth2", "api_key", "none"];
const VALID_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE"];

/**
 * Validate the user config and emit console.warn for each issue found.
 * Returns true if the config is structurally valid enough to serve.
 */
function validateConfig(config: AgentConfig): boolean {
  const warnings: string[] = [];

  if (!config) {
    warnings.push("Config is missing or undefined.");
    emitWarnings(warnings);
    return false;
  }

  // Top-level required fields
  if (!config.name || typeof config.name !== "string") {
    warnings.push('Missing or invalid "name" (expected non-empty string).');
  }
  if (!config.description || typeof config.description !== "string") {
    warnings.push(
      'Missing or invalid "description" (expected non-empty string).'
    );
  }
  if (!config.base_url || typeof config.base_url !== "string") {
    warnings.push(
      'Missing or invalid "base_url" (expected non-empty string).'
    );
  }

  // Auth
  if (!config.auth || typeof config.auth !== "object") {
    warnings.push('Missing or invalid "auth" object.');
  } else if (
    !config.auth.type ||
    !VALID_AUTH_TYPES.includes(config.auth.type)
  ) {
    warnings.push(
      `Invalid "auth.type". Expected one of: ${VALID_AUTH_TYPES.join(", ")}.`
    );
  }

  // Capabilities
  if (!Array.isArray(config.capabilities) || config.capabilities.length === 0) {
    warnings.push('Missing or empty "capabilities" array.');
  } else {
    config.capabilities.forEach((cap, idx) => {
      const prefix = `capabilities[${idx}]`;

      if (!cap.name || typeof cap.name !== "string") {
        warnings.push(`${prefix}: Missing or invalid "name".`);
      }
      if (!cap.description || typeof cap.description !== "string") {
        warnings.push(`${prefix}: Missing or invalid "description".`);
      }
      if (!cap.endpoint || typeof cap.endpoint !== "string") {
        warnings.push(`${prefix}: Missing or invalid "endpoint".`);
      }
      if (!cap.method || typeof cap.method !== "string") {
        warnings.push(`${prefix}: Missing or invalid "method".`);
      } else if (!VALID_METHODS.includes(cap.method.toUpperCase())) {
        warnings.push(
          `${prefix}: Invalid "method" (${cap.method}). Expected one of: ${VALID_METHODS.join(", ")}.`
        );
      }

      // Parameters
      if (!Array.isArray(cap.parameters)) {
        warnings.push(`${prefix}: "parameters" must be an array.`);
      } else {
        cap.parameters.forEach((param, pIdx) => {
          const pPrefix = `${prefix}.parameters[${pIdx}]`;
          if (!param.name || typeof param.name !== "string") {
            warnings.push(`${pPrefix}: Missing or invalid "name".`);
          }
          if (!param.type || typeof param.type !== "string") {
            warnings.push(`${pPrefix}: Missing or invalid "type".`);
          }
          if (typeof param.required !== "boolean") {
            warnings.push(
              `${pPrefix}: Missing or invalid "required" (expected boolean).`
            );
          }
          if (!param.description || typeof param.description !== "string") {
            warnings.push(`${pPrefix}: Missing or invalid "description".`);
          }
        });
      }
    });
  }

  emitWarnings(warnings);
  return warnings.length === 0;
}

function emitWarnings(warnings: string[]): void {
  for (const w of warnings) {
    console.warn(`[agent-well-known-next] ${w}`);
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build the auth header used in auto-generated request examples.
 */
function buildAuthHeaders(auth: AuthConfig): Record<string, string> {
  switch (auth.type) {
    case "oauth2":
      return { Authorization: "Bearer {access_token}" };
    case "api_key": {
      const header = auth.header || "Authorization";
      const prefix = auth.prefix ? `${auth.prefix} ` : "";
      return { [header]: `${prefix}{api_key}` };
    }
    default:
      return {};
  }
}

/**
 * Auto-generate a request_example from the capability definition.
 */
function generateRequestExample(
  cap: CapabilityConfig,
  config: AgentConfig
): RequestExample {
  const method = cap.method.toUpperCase();
  const url = `${config.base_url.replace(/\/+$/, "")}${cap.endpoint}`;

  const headers: Record<string, string> = {
    ...buildAuthHeaders(config.auth),
    "Content-Type": "application/json",
  };

  const example: RequestExample = { method, url, headers };

  // Build body from required parameters with example values
  if (
    ["POST", "PUT", "PATCH"].includes(method) &&
    Array.isArray(cap.parameters)
  ) {
    const body: Record<string, unknown> = {};
    for (const param of cap.parameters) {
      if (param.required && param.example !== undefined) {
        body[param.name] = param.example;
      }
    }
    if (Object.keys(body).length > 0) {
      example.body = body;
    }
  }

  return example;
}

// ---------------------------------------------------------------------------
// Builders
// ---------------------------------------------------------------------------

/**
 * Build the spec v1.0 manifest from user config.
 */
function buildManifest(config: AgentConfig): Manifest {
  const manifest: Manifest = {
    spec_version: "1.0",
    name: config.name,
    description: config.description,
    base_url: config.base_url,
    auth: config.auth,
    capabilities: (config.capabilities || []).map((cap) => {
      const entry: ManifestCapability = {
        name: cap.name,
        description: cap.description,
        detail_url: `/.well-known/agent/capabilities/${cap.name}`,
      };
      if (cap.resource_group) {
        entry.resource_group = cap.resource_group;
      }
      return entry;
    }),
  };

  if (config.pricing) {
    manifest.pricing = config.pricing;
  }

  return manifest;
}

/**
 * Build the capability detail JSON for a single capability.
 */
function buildCapabilityDetail(
  cap: CapabilityConfig,
  config: AgentConfig
): CapabilityDetail {
  const detail: CapabilityDetail = {
    name: cap.name,
    description: cap.description,
    endpoint: cap.endpoint,
    method: cap.method.toUpperCase(),
    parameters: (cap.parameters || []).map((p) => {
      const param: CapabilityDetail["parameters"][number] = {
        name: p.name,
        type: p.type,
        description: p.description,
        required: p.required,
      };
      if (p.example !== undefined) {
        param.example = p.example;
      }
      if (p.in) {
        param.in = p.in;
      }
      return param;
    }),
    request_example:
      cap.request_example || generateRequestExample(cap, config),
  };

  if (cap.response_example) {
    detail.response_example = cap.response_example;
  }

  if (cap.auth_scopes) {
    detail.auth_scopes = cap.auth_scopes;
  }

  if (cap.rate_limits) {
    detail.rate_limits = cap.rate_limits;
  }

  if (cap.resource_group) {
    detail.resource_group = cap.resource_group;
  }

  return detail;
}

// ---------------------------------------------------------------------------
// Next.js request/response types (minimal to avoid hard dependency)
// ---------------------------------------------------------------------------

/**
 * Minimal NextRequest shape. Compatible with next/server NextRequest.
 * We use a minimal type so the library compiles without requiring next
 * to be present at build time (it is a peerDependency, resolved at runtime).
 */
interface NextRequestLike {
  url: string;
  method: string;
}

/**
 * Matches Next.js App Router dynamic route context.
 * Next.js 13 passes params directly; Next.js 15+ wraps them in a Promise.
 */
interface RouteContext {
  params: { name: string } | Promise<{ name: string }>;
}

// We use the global Response (Web API) which Next.js re-exports.
// This avoids importing from "next/server" at compile time.

// ---------------------------------------------------------------------------
// CORS & cache helpers
// ---------------------------------------------------------------------------

const CORS_HEADERS: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const CACHE_HEADERS: Record<string, string> = {
  "Cache-Control": "public, max-age=3600",
};

function jsonResponse(
  data: unknown,
  status: number = 200,
  extraHeaders: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
      ...CACHE_HEADERS,
      ...extraHeaders,
    },
  });
}

function notFoundResponse(message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status: 404,
    headers: {
      "Content-Type": "application/json",
      ...CORS_HEADERS,
    },
  });
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Create a Next.js App Router GET handler that serves the Agent Discovery
 * Protocol manifest at `/.well-known/agent`.
 *
 * Usage in `app/.well-known/agent/route.ts`:
 * ```ts
 * import { createAgentManifest } from 'agent-well-known-next';
 *
 * export const GET = createAgentManifest({ ... });
 * ```
 */
export function createAgentManifest(
  config: AgentConfig
): (request: NextRequestLike) => Promise<Response> {
  let validated = false;
  let manifest: Manifest | null = null;

  return async function manifestHandler(
    _request: NextRequestLike
  ): Promise<Response> {
    // Validate once on first request
    if (!validated) {
      validateConfig(config);
      manifest = buildManifest(config);
      validated = true;
    }

    return jsonResponse(manifest);
  };
}

/**
 * Create a Next.js App Router GET handler that serves capability detail
 * at `/.well-known/agent/capabilities/[name]`.
 *
 * Usage in `app/.well-known/agent/capabilities/[name]/route.ts`:
 * ```ts
 * import { createCapabilityDetail } from 'agent-well-known-next';
 *
 * export const GET = createCapabilityDetail(config);
 * ```
 */
export function createCapabilityDetail(
  config: AgentConfig
): (request: NextRequestLike, context: RouteContext) => Promise<Response> {
  let validated = false;
  let detailMap: Record<string, CapabilityDetail> | null = null;

  return async function capabilityHandler(
    _request: NextRequestLike,
    context: RouteContext
  ): Promise<Response> {
    // Validate once on first request
    if (!validated) {
      validateConfig(config);
      detailMap = {};
      for (const cap of config.capabilities || []) {
        detailMap[cap.name] = buildCapabilityDetail(cap, config);
      }
      validated = true;
    }

    // Resolve params (Next.js 15+ returns a Promise, 13-14 returns plain object)
    const params = await Promise.resolve(context.params);
    const name = params.name;
    const detail = detailMap![name];

    if (!detail) {
      return notFoundResponse(`Capability not found: ${name}`);
    }

    return jsonResponse(detail);
  };
}

/**
 * Convenience function that returns both route handlers and the config
 * reference, so you can wire up both routes from a single config object.
 *
 * Usage:
 * ```ts
 * const { manifestHandler, capabilityHandler } = createAgentRoutes({ ... });
 *
 * // app/.well-known/agent/route.ts
 * export const GET = manifestHandler;
 *
 * // app/.well-known/agent/capabilities/[name]/route.ts
 * export const GET = capabilityHandler;
 * ```
 */
export function createAgentRoutes(config: AgentConfig): {
  manifestHandler: (request: NextRequestLike) => Promise<Response>;
  capabilityHandler: (
    request: NextRequestLike,
    context: RouteContext
  ) => Promise<Response>;
  config: AgentConfig;
} {
  return {
    manifestHandler: createAgentManifest(config),
    capabilityHandler: createCapabilityDetail(config),
    config,
  };
}
