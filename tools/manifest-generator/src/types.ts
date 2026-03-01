// ---- Agent Discovery Protocol manifest types ----

export interface ManifestAuth {
  type: "oauth2" | "api_key" | "none";
  authorization_url?: string;
  token_url?: string;
  scopes?: string[];
  header?: string;
  prefix?: string;
  setup_url?: string;
}

export interface ManifestPricing {
  type: "free" | "freemium" | "paid";
  plans?: Array<{ name: string; price: string; limits: string }>;
  plans_url?: string;
}

export interface ManifestCapability {
  name: string;
  description: string;
  detail_url: string;
}

export interface Manifest {
  spec_version: "1.0";
  name: string;
  description: string;
  base_url: string;
  auth: ManifestAuth;
  pricing?: ManifestPricing;
  capabilities: ManifestCapability[];
}

// ---- Capability detail types ----

export interface CapabilityParameter {
  name: string;
  type: string;
  description: string;
  required: boolean;
  example?: unknown;
}

export interface CapabilityDetail {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  parameters: CapabilityParameter[];
  request_example: {
    method: string;
    url: string;
    headers: Record<string, string>;
    body?: unknown;
  };
  response_example: {
    status: number;
    body: unknown;
  };
  auth_scopes?: string[];
  rate_limits?: {
    requests_per_minute?: number;
    daily_limit?: number;
  };
}

// ---- Catalog types ----

export interface CatalogEntry {
  domain: string;
  category: string;
  openapi?: string;
  docs?: string;
  type?: "google-discovery" | "openapi";
  name?: string;
}

export interface Catalog {
  apis: CatalogEntry[];
}

// ---- OpenAPI types (simplified) ----

export interface OpenAPISpec {
  openapi?: string;
  swagger?: string;
  info: {
    title: string;
    description?: string;
    version?: string;
  };
  servers?: Array<{ url: string; description?: string }>;
  host?: string;
  basePath?: string;
  schemes?: string[];
  paths: Record<string, Record<string, OpenAPIOperation>>;
  components?: {
    securitySchemes?: Record<string, OpenAPISecurityScheme>;
    schemas?: Record<string, unknown>;
  };
  securityDefinitions?: Record<string, OpenAPISecurityScheme>;
  tags?: Array<{ name: string; description?: string }>;
}

export interface OpenAPIOperation {
  operationId?: string;
  summary?: string;
  description?: string;
  tags?: string[];
  parameters?: OpenAPIParameter[];
  requestBody?: {
    description?: string;
    required?: boolean;
    content?: Record<string, { schema?: unknown; example?: unknown; examples?: Record<string, { value?: unknown }> }>;
  };
  responses?: Record<string, {
    description?: string;
    content?: Record<string, { schema?: unknown; example?: unknown; examples?: Record<string, { value?: unknown }> }>;
  }>;
  security?: Array<Record<string, string[]>>;
  deprecated?: boolean;
}

export interface OpenAPIParameter {
  name: string;
  in: "query" | "path" | "header" | "cookie" | "body";
  description?: string;
  required?: boolean;
  schema?: { type?: string; format?: string; enum?: string[]; example?: unknown; items?: unknown; default?: unknown };
  type?: string;
  example?: unknown;
}

export interface OpenAPISecurityScheme {
  type: string;
  scheme?: string;
  bearerFormat?: string;
  in?: string;
  name?: string;
  flows?: Record<string, {
    authorizationUrl?: string;
    tokenUrl?: string;
    scopes?: Record<string, string>;
  }>;
  authorizationUrl?: string;
  tokenUrl?: string;
  flow?: string;
  scopes?: Record<string, string>;
}

// ---- Google Discovery types ----

export interface GoogleDiscoverySpec {
  kind: string;
  name: string;
  version: string;
  title: string;
  description: string;
  rootUrl: string;
  servicePath: string;
  baseUrl?: string;
  auth?: {
    oauth2?: {
      scopes?: Record<string, { description: string }>;
    };
  };
  resources: Record<string, GoogleDiscoveryResource>;
}

export interface GoogleDiscoveryResource {
  methods?: Record<string, GoogleDiscoveryMethod>;
  resources?: Record<string, GoogleDiscoveryResource>;
}

export interface GoogleDiscoveryMethod {
  id: string;
  path: string;
  httpMethod: string;
  description?: string;
  parameters?: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
    location?: string;
    enum?: string[];
    default?: string;
  }>;
  request?: { $ref: string };
  response?: { $ref: string };
  scopes?: string[];
}

// ---- Generation result types ----

export interface GenerationResult {
  domain: string;
  success: boolean;
  manifest?: Manifest;
  capabilities?: CapabilityDetail[];
  errors: string[];
  source: "openapi" | "google-discovery" | "docs-scrape";
}

export interface QualityReport {
  domain: string;
  score: number;
  issues: QualityIssue[];
  pass: boolean;
}

export interface QualityIssue {
  severity: "error" | "warning" | "info";
  field: string;
  message: string;
}
