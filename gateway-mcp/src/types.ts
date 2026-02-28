export interface ManifestCapability {
  name: string;
  description: string;
  detail_url: string;
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
  parameters: Array<{
    name: string;
    type: string;
    description: string;
    required: boolean;
    example: unknown;
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

export interface DiscoverResult {
  service: {
    name: string;
    domain: string;
    description: string;
    base_url: string;
    auth_type: string;
    pricing_type: string;
    verified: boolean;
  };
  matching_capabilities: Array<{
    name: string;
    description: string;
    detail_url: string;
  }>;
  all_capabilities: Array<{
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
