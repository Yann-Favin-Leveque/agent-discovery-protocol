# agent-well-known-next

Next.js App Router helpers for the [Agent Discovery Protocol](https://github.com/user/agent-discovery-protocol). Serve a `/.well-known/agent` manifest and capability detail endpoints with zero boilerplate.

This package generates spec-v1.0 compliant endpoints so any AI agent can discover and use your service at runtime -- no plugins, no installation, no per-service configuration.

## Install

```bash
npm install agent-well-known-next
```

> Requires Next.js 13+ with the App Router.

## Quick Start

### 1. Define your config

Create a shared config file (or inline it):

```ts
// lib/agent-config.ts
import type { AgentConfig } from 'agent-well-known-next';

export const agentConfig: AgentConfig = {
  name: "My API",
  description: "What my API does, in 2-3 sentences. Write for an LLM to understand.",
  base_url: "https://api.example.com",
  auth: {
    type: "api_key",
    header: "Authorization",
    prefix: "Bearer",
    setup_url: "https://example.com/api-keys",
  },
  capabilities: [
    {
      name: "send_email",
      description: "Send an email to one or more recipients.",
      endpoint: "/api/emails",
      method: "POST",
      parameters: [
        { name: "to", type: "string", required: true, description: "Recipient email address.", example: "alice@example.com" },
        { name: "subject", type: "string", required: true, description: "Email subject.", example: "Hello" },
        { name: "body", type: "string", required: true, description: "Email body (plain text or HTML).", example: "<p>Hi!</p>" },
      ],
      response_example: {
        status: 200,
        body: { success: true, data: { message_id: "msg_abc123", status: "sent" } },
      },
      auth_scopes: ["email.send"],
      rate_limits: { requests_per_minute: 60, daily_limit: 1000 },
    },
  ],
};
```

### 2. Create the manifest route

```
app/.well-known/agent/route.ts
```

```ts
import { createAgentManifest } from 'agent-well-known-next';
import { agentConfig } from '@/lib/agent-config';

export const GET = createAgentManifest(agentConfig);
```

### 3. Create the capability detail route

```
app/.well-known/agent/capabilities/[name]/route.ts
```

```ts
import { createCapabilityDetail } from 'agent-well-known-next';
import { agentConfig } from '@/lib/agent-config';

export const GET = createCapabilityDetail(agentConfig);
```

That's it. Your Next.js app now serves:

- `GET /.well-known/agent` -- the service manifest
- `GET /.well-known/agent/capabilities/send_email` -- capability detail

### Alternative: single-import convenience

```ts
import { createAgentRoutes } from 'agent-well-known-next';
import { agentConfig } from '@/lib/agent-config';

export const { manifestHandler, capabilityHandler } = createAgentRoutes(agentConfig);

// app/.well-known/agent/route.ts
export const GET = manifestHandler;

// app/.well-known/agent/capabilities/[name]/route.ts
export const GET = capabilityHandler;
```

## What Gets Generated

### Manifest (`/.well-known/agent`)

```json
{
  "spec_version": "1.0",
  "name": "My API",
  "description": "What my API does.",
  "base_url": "https://api.example.com",
  "auth": { "type": "api_key", "header": "Authorization", "prefix": "Bearer", "setup_url": "https://example.com/api-keys" },
  "capabilities": [
    {
      "name": "send_email",
      "description": "Send an email to one or more recipients.",
      "detail_url": "/.well-known/agent/capabilities/send_email"
    }
  ]
}
```

### Capability Detail (`/.well-known/agent/capabilities/send_email`)

```json
{
  "name": "send_email",
  "description": "Send an email to one or more recipients.",
  "endpoint": "/api/emails",
  "method": "POST",
  "parameters": [
    { "name": "to", "type": "string", "required": true, "description": "Recipient email address.", "example": "alice@example.com" },
    { "name": "subject", "type": "string", "required": true, "description": "Email subject.", "example": "Hello" },
    { "name": "body", "type": "string", "required": true, "description": "Email body (plain text or HTML).", "example": "<p>Hi!</p>" }
  ],
  "request_example": {
    "method": "POST",
    "url": "https://api.example.com/api/emails",
    "headers": { "Authorization": "Bearer {api_key}", "Content-Type": "application/json" },
    "body": { "to": "alice@example.com", "subject": "Hello", "body": "<p>Hi!</p>" }
  },
  "response_example": {
    "status": 200,
    "body": { "success": true, "data": { "message_id": "msg_abc123", "status": "sent" } }
  },
  "auth_scopes": ["email.send"],
  "rate_limits": { "requests_per_minute": 60, "daily_limit": 1000 }
}
```

## Config Reference

### `AgentConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Human-readable service name. |
| `description` | `string` | Yes | 2-3 sentences for LLM understanding. |
| `base_url` | `string` | Yes | Base URL for all API calls. |
| `auth` | `AuthConfig` | Yes | Authentication configuration. |
| `pricing` | `PricingConfig` | No | Pricing information. |
| `capabilities` | `CapabilityConfig[]` | Yes | Service capabilities. |

### `AuthConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"oauth2" \| "api_key" \| "none"` | Yes | Auth mechanism. |
| `authorization_url` | `string` | oauth2 | OAuth2 authorization URL. |
| `token_url` | `string` | oauth2 | OAuth2 token URL. |
| `scopes` | `string[]` | No | OAuth2 scopes. |
| `header` | `string` | No | Header name for API key (default: `Authorization`). |
| `prefix` | `string` | No | Prefix before the key value (e.g. `Bearer`). |
| `setup_url` | `string` | No | URL where users manage API keys. |

### `PricingConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `type` | `"free" \| "freemium" \| "paid"` | Yes | Pricing model. |
| `plans` | `Array<{ name, price, limits }>` | No | Available plans. |
| `plans_url` | `string` | No | URL to full pricing page. |

### `CapabilityConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Machine-readable identifier (snake_case). |
| `description` | `string` | Yes | 1-2 sentences for LLM understanding. |
| `endpoint` | `string` | Yes | API path relative to `base_url`. |
| `method` | `string` | Yes | HTTP method: GET, POST, PUT, PATCH, DELETE. |
| `parameters` | `ParameterConfig[]` | Yes | Parameter definitions. |
| `request_example` | `object` | No | Explicit request example. Auto-generated if omitted. |
| `response_example` | `object` | No | Example response with status and body. |
| `auth_scopes` | `string[]` | No | Scopes required for this capability. |
| `rate_limits` | `object` | No | Rate limiting info. |

### `ParameterConfig`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Parameter name. |
| `type` | `string` | Yes | Type: string, number, boolean, object, string[], object[]. |
| `required` | `boolean` | Yes | Whether required. |
| `description` | `string` | Yes | Human-readable description. |
| `example` | `any` | No | Example value. Used in auto-generated request examples. |

## Auto-Generation

The SDK automatically handles:

- **`spec_version`**: Always set to `"1.0"`.
- **`detail_url`**: Generated as `/.well-known/agent/capabilities/{name}` for each capability.
- **`request_example`**: If not provided, built from `base_url` + `endpoint` + `method` + required parameters with examples + auth headers.
- **CORS headers**: `Access-Control-Allow-Origin: *` on all responses.
- **Cache headers**: `Cache-Control: public, max-age=3600` on all responses.
- **Validation**: Runs once on first request. Issues are logged via `console.warn` -- the server still starts.

## Spec & Registry

- [Agent Discovery Protocol Spec](https://github.com/user/agent-discovery-protocol/tree/main/spec)
- [Agent Discovery Registry](https://registry.agentdiscovery.dev)

## License

MIT
