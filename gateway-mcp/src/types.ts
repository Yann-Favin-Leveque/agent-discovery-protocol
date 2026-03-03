// ─── Manifest types ──────────────────────────────────────────────

export interface ManifestCapability {
  name: string;
  description: string;
  detail_url: string;
  resource_group?: string;
}

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

export interface Manifest {
  spec_version: string;
  name: string;
  description: string;
  base_url: string;
  auth: ManifestAuth;
  pricing?: ManifestPricing;
  capabilities: ManifestCapability[];
}

export interface CapabilityDetail {
  name: string;
  description: string;
  endpoint: string;
  method: string;
  resource_group?: string;
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    example: unknown;
    in?: "path" | "query" | "body" | "header";
  }>;
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

// ─── Identity & auth ─────────────────────────────────────────────

export type IdentityProvider = "google" | "github" | "microsoft";

export interface UserIdentity {
  provider: IdentityProvider;
  provider_id: string;
  email: string;
  name?: string;
  avatar_url?: string;
  registry_token: string; // JWT from registry after OAuth
  registry_refresh_token?: string;
  connected_at: string;
}

export interface StoredToken {
  domain: string;
  type: "oauth2" | "api_key";
  access_token: string;
  refresh_token?: string;
  expires_at?: number;
  scopes?: string[];
}

export interface Connection {
  domain: string;
  service_name: string;
  auth_type: string;
  token?: StoredToken;
  subscription?: {
    plan: string;
    status: "active" | "cancelled";
  };
  connected_at: string;
}

// ─── Cache ───────────────────────────────────────────────────────

export interface CacheEntry<T> {
  data: T;
  cached_at: number;
  ttl: number; // milliseconds
}

export const CACHE_TTLS = {
  discovery: 15 * 60 * 1000,        // 15 minutes
  manifest: 60 * 60 * 1000,         // 1 hour  — manifests rarely change
  capability: 60 * 60 * 1000,       // 1 hour  — capability details rarely change
} as const;

// ─── Service setup guides ───────────────────────────────────────

export interface CredentialField {
  name: string;           // param name for auth tool (e.g. "api_key", "client_id")
  label: string;          // human label (e.g. "API Key")
  description: string;    // help text
  secret: boolean;        // mask in display
  placeholder?: string;   // e.g. "sk-..."
}

export interface TestEndpoint {
  method: "GET" | "POST" | "HEAD";
  path: string;           // relative to base_url
  expected_status?: number;
  description?: string;
}

export interface ServiceGuide {
  domain: string;
  display_name: string;
  auth_type: "api_key" | "oauth2" | "none";
  portal_url: string;
  steps: string[];
  credential_fields: CredentialField[];
  notes: string[];
  extra_oauth_params?: Record<string, string>;
  test_endpoint?: TestEndpoint;
  last_verified?: string;
}

// ─── User-owned credentials ─────────────────────────────────────

export interface OAuth2Credential {
  type: "oauth2";
  client_id: string;
  client_secret: string;
  added_at: string;
}

export interface ApiKeyCredential {
  type: "api_key";
  api_key: string;
  added_at: string;
}

export type UserCredential = OAuth2Credential | ApiKeyCredential;

export interface CredentialStore {
  version: 1;
  credentials: Record<string, UserCredential>;
}

// ─── Config ──────────────────────────────────────────────────────

export interface GatewayConfig {
  registry_url: string;
  auth_callback_port: number;
  identity?: UserIdentity;
}

// ─── Registry API types ──────────────────────────────────────────

export interface DiscoverResult {
  service: {
    name: string;
    domain: string;
    description: string;
    base_url: string;
    auth_type: string;
    pricing_type: string;
    verified: boolean;
    trust_level?: string;
    cap_count?: number;
  };
  matching_capabilities: Array<{
    name: string;
    description: string;
    detail_url: string;
  }>;
}

export interface RegistryDiscoverResponse {
  success: boolean;
  query: string;
  result_count: number;
  data: DiscoverResult[];
}
