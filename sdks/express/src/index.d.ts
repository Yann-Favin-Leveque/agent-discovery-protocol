import { Router } from 'express';

/**
 * Auth configuration for the service manifest.
 */
export interface AuthOAuth2 {
  type: 'oauth2';
  authorization_url: string;
  token_url: string;
  scopes?: string[];
}

export interface AuthApiKey {
  type: 'api_key';
  header?: string;
  prefix?: string;
  setup_url?: string;
}

export interface AuthNone {
  type: 'none';
}

export type AuthConfig = AuthOAuth2 | AuthApiKey | AuthNone;

/**
 * A pricing plan entry.
 */
export interface PricingPlan {
  name: string;
  price: string;
  limits?: string;
}

/**
 * Pricing configuration for the service manifest.
 */
export interface PricingConfig {
  type: 'free' | 'freemium' | 'paid';
  plans?: PricingPlan[];
  plans_url?: string;
}

/**
 * A parameter definition for a capability.
 */
export interface ParameterConfig {
  name: string;
  type: string;
  required: boolean;
  description: string;
  example?: any;
}

/**
 * Handler configuration specifying the actual API endpoint.
 */
export interface HandlerConfig {
  endpoint: string;
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
}

/**
 * Rate limit configuration for a capability.
 */
export interface RateLimitConfig {
  requests_per_minute?: number;
  daily_limit?: number;
  [key: string]: any;
}

/**
 * Example request object following the spec.
 */
export interface RequestExample {
  method: string;
  url: string;
  headers?: Record<string, string>;
  body?: any;
}

/**
 * Example response object following the spec.
 */
export interface ResponseExample {
  status: number;
  body?: any;
}

/**
 * A capability definition provided by the user.
 */
export interface CapabilityConfig {
  /** Machine-readable identifier (snake_case). */
  name: string;
  /** 1-2 sentence description for LLM understanding. */
  description: string;
  /** The real API endpoint and HTTP method for this capability. */
  handler: HandlerConfig;
  /** Parameter definitions. */
  parameters?: ParameterConfig[];
  /** A complete request example. Auto-generated from parameters if omitted. */
  request_example?: RequestExample;
  /** A complete response example. */
  response_example?: ResponseExample;
  /** OAuth scopes needed for this capability. */
  auth_scopes?: string[];
  /** Rate limiting information. */
  rate_limits?: RateLimitConfig;
  /** Logical resource group for organizing related capabilities (e.g. "messages", "users"). */
  resource_group?: string;
}

/**
 * Full service configuration passed to `agentManifest()`.
 */
export interface AgentManifestConfig {
  /** Human-readable service name. */
  name: string;
  /** 2-3 sentence description of the service, written for an LLM. */
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

/**
 * Create an Express Router that serves Agent Discovery Protocol endpoints.
 *
 * Registers:
 *   GET /.well-known/agent                        — service manifest (JSON)
 *   GET /.well-known/agent/capabilities/:name      — capability detail (JSON)
 *
 * @param config  Service configuration following the Agent Discovery Protocol spec v1.0.
 * @returns       An Express Router to mount with `app.use()`.
 */
export function agentManifest(config: AgentManifestConfig): Router;
