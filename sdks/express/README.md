# agent-well-known-express

Express middleware that auto-generates [Agent Discovery Protocol](https://github.com/user/agent-discovery-protocol/tree/main/spec) endpoints so any AI agent can discover and use your API at runtime.

## Install

```bash
npm install agent-well-known-express
```

> **Peer dependency:** Express 4.x or 5.x must be installed in your project.

## Quick Start

```js
const express = require('express');
const { agentManifest } = require('agent-well-known-express');

const app = express();

app.use(agentManifest({
  name: "Acme Email",
  description: "Send and receive emails programmatically. Supports HTML content, attachments, and inbox management.",
  base_url: "https://api.acme-email.com",
  auth: {
    type: "api_key",
    header: "Authorization",
    prefix: "Bearer",
    setup_url: "https://acme-email.com/api-keys"
  },
  pricing: {
    type: "freemium",
    plans: [
      { name: "Free", price: "$0/mo", limits: "100 emails/day" },
      { name: "Pro", price: "$9/mo", limits: "Unlimited" }
    ],
    plans_url: "https://acme-email.com/pricing"
  },
  capabilities: [
    {
      name: "send_email",
      description: "Send an email to one or more recipients with subject, body (plain text or HTML), and optional attachments.",
      handler: {
        endpoint: "/v1/emails/send",
        method: "POST"
      },
      parameters: [
        { name: "to", type: "string", required: true, description: "Recipient email address.", example: "alice@example.com" },
        { name: "subject", type: "string", required: true, description: "Email subject line.", example: "Hello" },
        { name: "body", type: "string", required: true, description: "Email body content.", example: "Hi there!" }
      ],
      response_example: {
        status: 200,
        body: {
          success: true,
          data: { message_id: "msg_abc123", status: "sent" }
        }
      },
      auth_scopes: ["email.send"],
      rate_limits: { requests_per_minute: 60 }
    },
    {
      name: "list_inbox",
      description: "List recent emails in the authenticated user's inbox with optional filtering.",
      handler: {
        endpoint: "/v1/emails/inbox",
        method: "GET"
      },
      parameters: [
        { name: "limit", type: "number", required: false, description: "Max emails to return.", example: 20 },
        { name: "sender", type: "string", required: false, description: "Filter by sender address.", example: "bob@example.com" }
      ],
      auth_scopes: ["email.read"],
      rate_limits: { requests_per_minute: 120 }
    }
  ]
}));

app.listen(3000, () => console.log('Listening on :3000'));
```

This registers two endpoints automatically:

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/agent` | The service manifest (JSON) |
| `GET /.well-known/agent/capabilities/:name` | Detail for a single capability |

Both endpoints include `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600` headers.

## Configuration Reference

### Top-level fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Human-readable service name. |
| `description` | `string` | Yes | 2-3 sentences describing the service. Written for an LLM to understand what this service does and when to use it. |
| `base_url` | `string` | Yes | Base URL for all API calls. |
| `auth` | `object` | Yes | Authentication configuration (see below). |
| `pricing` | `object` | No | Pricing information (see below). |
| `capabilities` | `array` | Yes | List of capability objects (see below). |

### Auth object

**OAuth 2.0:**

```js
{
  type: "oauth2",
  authorization_url: "https://auth.example.com/authorize",
  token_url: "https://auth.example.com/token",
  scopes: ["read", "write"]
}
```

**API Key:**

```js
{
  type: "api_key",
  header: "Authorization",   // optional, defaults to "Authorization"
  prefix: "Bearer",          // optional
  setup_url: "https://example.com/api-keys"  // optional
}
```

**None (public API):**

```js
{ type: "none" }
```

### Pricing object (optional)

```js
{
  type: "free",       // "free" | "freemium" | "paid"
  plans: [
    { name: "Free", price: "$0/mo", limits: "1000 requests/day" }
  ],
  plans_url: "https://example.com/pricing"
}
```

### Capability object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Machine-readable identifier (snake_case). |
| `description` | `string` | Yes | 1-2 sentence description for LLM understanding. |
| `handler` | `object` | Yes | `{ endpoint: string, method: string }` — the real API route. |
| `parameters` | `array` | No | Parameter definitions (see below). |
| `request_example` | `object` | No | Complete request example. Auto-generated if omitted. |
| `response_example` | `object` | No | Complete response example. |
| `auth_scopes` | `string[]` | No | OAuth scopes needed for this capability. |
| `rate_limits` | `object` | No | Rate limiting info (e.g. `{ requests_per_minute: 60 }`). |

### Parameter object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `string` | Yes | Parameter name. |
| `type` | `string` | Yes | Type: `string`, `number`, `boolean`, `object`, `string[]`, `object[]`. |
| `required` | `boolean` | Yes | Whether this parameter is required. |
| `description` | `string` | Yes | What this parameter does. |
| `example` | `any` | No | Example value (used in auto-generated request_example). |

## What Gets Generated

### Manifest (`GET /.well-known/agent`)

Returns a spec-v1.0 manifest with `detail_url` auto-populated for each capability:

```json
{
  "spec_version": "1.0",
  "name": "Acme Email",
  "description": "Send and receive emails programmatically...",
  "base_url": "https://api.acme-email.com",
  "auth": { "type": "api_key", "header": "Authorization", "prefix": "Bearer", "setup_url": "..." },
  "pricing": { "type": "freemium", "plans": [...], "plans_url": "..." },
  "capabilities": [
    {
      "name": "send_email",
      "description": "Send an email to one or more recipients...",
      "detail_url": "/.well-known/agent/capabilities/send_email"
    }
  ]
}
```

### Capability Detail (`GET /.well-known/agent/capabilities/:name`)

Returns everything an agent needs to call the API:

```json
{
  "name": "send_email",
  "description": "Send an email to one or more recipients...",
  "endpoint": "/v1/emails/send",
  "method": "POST",
  "parameters": [
    { "name": "to", "type": "string", "description": "Recipient email address.", "required": true, "example": "alice@example.com" }
  ],
  "request_example": {
    "method": "POST",
    "url": "https://api.acme-email.com/v1/emails/send",
    "headers": { "Authorization": "Bearer {api_key}", "Content-Type": "application/json" },
    "body": { "to": "alice@example.com", "subject": "Hello", "body": "Hi there!" }
  },
  "response_example": { "status": 200, "body": { "success": true, "data": { "message_id": "msg_abc123" } } },
  "auth_scopes": ["email.send"],
  "rate_limits": { "requests_per_minute": 60 }
}
```

If you omit `request_example` from a capability, the middleware generates one automatically from `base_url`, `handler`, `auth`, and the required parameters' example values.

## Startup Validation

The middleware validates your configuration on startup and logs warnings via `console.warn` for any issues (missing fields, invalid types, etc.). It does **not** throw or crash — your server will still start even with a misconfigured manifest.

## Spec

This middleware implements the [Agent Discovery Protocol Specification v1.0](https://github.com/user/agent-discovery-protocol/tree/main/spec).

## Registry

Register your service in the [Agent Discovery Registry](https://registry.agentdiscovery.dev) so AI agents can find it.

## License

MIT
