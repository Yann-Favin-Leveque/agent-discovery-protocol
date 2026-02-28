# Agent Discovery Protocol — Specification v1.0

A web standard for AI agent-to-service discovery. Any service adds one endpoint, any agent discovers it at runtime. No plugins, no installation, no configuration.

---

## Table of Contents

1. [The `/.well-known/agent` Endpoint](#1-the-well-knownagent-endpoint)
2. [Manifest Format](#2-manifest-format)
3. [Capability Detail Format](#3-capability-detail-format)
4. [Discovery Flow](#4-discovery-flow)
5. [Why Not MCP?](#5-why-not-mcp)
6. [Implementation Guide](#6-implementation-guide)

---

## 1. The `/.well-known/agent` Endpoint

Following [RFC 8615](https://datatracker.ietf.org/doc/html/rfc8615), every service implementing this protocol exposes a single endpoint:

```
GET https://api.example.com/.well-known/agent
```

**Rules:**

- **MUST** return JSON with `Content-Type: application/json`
- **MUST** be publicly accessible — no authentication required to read the manifest
- **MUST** respond within 5 seconds
- **MUST** return HTTP 200 on success
- **SHOULD** support CORS (`Access-Control-Allow-Origin: *`) so browser-based agents can discover services
- **SHOULD** be cacheable (include `Cache-Control` headers, recommended: 1 hour)

---

## 2. Manifest Format

The manifest is the JSON document returned by the `/.well-known/agent` endpoint.

```json
{
  "spec_version": "1.0",
  "name": "Acme Email",
  "description": "Send and receive emails programmatically. Supports HTML content, attachments, and inbox management. Ideal for agents that need to communicate with humans via email.",
  "base_url": "https://api.acme-email.com",
  "auth": {
    "type": "oauth2",
    "authorization_url": "https://auth.acme-email.com/authorize",
    "token_url": "https://auth.acme-email.com/token",
    "scopes": ["email.send", "email.read"]
  },
  "pricing": {
    "type": "freemium",
    "plans": [
      { "name": "Free", "price": "$0/mo", "limits": "100 emails/day" },
      { "name": "Pro", "price": "$9/mo", "limits": "Unlimited" }
    ],
    "plans_url": "https://acme-email.com/pricing"
  },
  "capabilities": [
    {
      "name": "send_email",
      "description": "Send an email to one or more recipients with subject, body (plain text or HTML), and optional attachments.",
      "detail_url": "/capabilities/send_email"
    },
    {
      "name": "list_inbox",
      "description": "List recent emails in the authenticated user's inbox, with optional filtering by sender or date.",
      "detail_url": "/capabilities/list_inbox"
    }
  ]
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `spec_version` | string | Yes | Protocol version. Currently `"1.0"`. |
| `name` | string | Yes | Human-readable service name. |
| `description` | string | Yes | 2-3 sentences describing the service. Written for an LLM to understand what this service does and when to use it. |
| `base_url` | string | Yes | Base URL for all API calls. Capability endpoints are relative to this. |
| `auth` | object | Yes | Authentication configuration (see below). |
| `pricing` | object | No | Pricing information (see below). |
| `capabilities` | array | Yes | List of capability objects (see below). |

### Auth Object

**OAuth 2.0:**

```json
{
  "type": "oauth2",
  "authorization_url": "https://auth.example.com/authorize",
  "token_url": "https://auth.example.com/token",
  "scopes": ["read", "write"]
}
```

**API Key:**

```json
{
  "type": "api_key",
  "header": "Authorization",
  "prefix": "Bearer",
  "setup_url": "https://example.com/developers/api-keys"
}
```

**None (public API):**

```json
{
  "type": "none"
}
```

### Pricing Object (optional)

```json
{
  "type": "free|freemium|paid",
  "plans": [
    { "name": "Free", "price": "$0/mo", "limits": "1000 requests/day" }
  ],
  "plans_url": "https://example.com/pricing"
}
```

### Capability Object

Each entry in the `capabilities` array is a lightweight summary. Full details are fetched on demand via `detail_url`.

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Machine-readable identifier (snake_case). |
| `description` | string | Yes | 1-2 sentences for LLM understanding. Describe what it does and when to use it. |
| `detail_url` | string | Yes | Relative (to `base_url`) or absolute URL returning the full capability detail. |

---

## 3. Capability Detail Format

When an agent needs to actually use a capability, it fetches the `detail_url`. This returns everything needed to make the API call.

```
GET https://api.example.com/capabilities/send_email
```

**Rules:**

- **MUST** return JSON with `Content-Type: application/json`
- **MUST** be publicly accessible (no auth required to read the detail)
- **SHOULD** be cacheable

```json
{
  "name": "send_email",
  "description": "Send an email to one or more recipients with subject, body (plain text or HTML), and optional attachments.",
  "endpoint": "/v1/emails/send",
  "method": "POST",
  "parameters": [
    { "name": "to", "type": "string[]", "description": "Recipient email addresses.", "required": true, "example": ["alice@example.com"] },
    { "name": "subject", "type": "string", "description": "Email subject line.", "required": true, "example": "Meeting tomorrow" },
    { "name": "body", "type": "string", "description": "Email body. Supports plain text or HTML.", "required": true, "example": "<p>Hi Alice, are we still on for tomorrow?</p>" },
    { "name": "attachments", "type": "object[]", "description": "Optional file attachments.", "required": false, "example": [{ "filename": "report.pdf", "content_base64": "..." }] }
  ],
  "request_example": {
    "method": "POST",
    "url": "https://api.acme-email.com/v1/emails/send",
    "headers": {
      "Authorization": "Bearer {access_token}",
      "Content-Type": "application/json"
    },
    "body": {
      "to": ["alice@example.com"],
      "subject": "Meeting tomorrow",
      "body": "<p>Hi Alice, are we still on for tomorrow?</p>"
    }
  },
  "response_example": {
    "status": 200,
    "body": {
      "success": true,
      "data": {
        "message_id": "msg_abc123",
        "status": "sent"
      }
    }
  },
  "auth_scopes": ["email.send"],
  "rate_limits": {
    "requests_per_minute": 60,
    "daily_limit": 1000
  }
}
```

### Field Reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Same as in manifest. |
| `description` | string | Yes | Same as in manifest. |
| `endpoint` | string | Yes | API path (relative to `base_url`). |
| `method` | string | Yes | HTTP method: `GET`, `POST`, `PUT`, `PATCH`, `DELETE`. |
| `parameters` | array | Yes | Parameter definitions (see below). |
| `request_example` | object | Yes | Complete example request including URL, headers, and body. |
| `response_example` | object | Yes | Complete example response including status code and body. |
| `auth_scopes` | string[] | No | Which auth scopes are needed for this specific capability. |
| `rate_limits` | object | No | Rate limiting info (`requests_per_minute`, `daily_limit`). |

### Parameter Object

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Parameter name. |
| `type` | string | Yes | Type: `string`, `number`, `boolean`, `object`, `string[]`, `object[]`. |
| `description` | string | Yes | What this parameter does. |
| `required` | boolean | Yes | Whether this parameter is required. |
| `example` | any | Yes | Example value. |

---

## 4. Discovery Flow

This is how an agent discovers and uses a service at runtime:

```
1. Agent has intent: "Send an email to Alice"
         │
         ▼
2. Agent queries Registry: discover("send email")
         │
         ▼
3. Registry returns matching services with manifests
         │
         ▼
4. Agent picks a service, reads its capabilities (from manifest)
         │
         ▼
5. Agent fetches detail_url for "send_email" capability
         │
         ▼
6. Agent authenticates (OAuth flow or API key)
         │
         ▼
7. Agent calls the endpoint with the right parameters
```

**Key insight:** Steps 1-4 are cheap. The manifest is small and gives the agent enough context to decide. Only step 5 fetches full detail — and only for the one capability the agent actually needs. This is **lazy drill-down**: no context window pollution.

---

## 5. Why Not MCP?

The Model Context Protocol (MCP) solves agent-to-service communication. We don't replace it — we build on top of it. Here's why this protocol exists:

| | MCP (status quo) | Agent Discovery Protocol |
|---|---|---|
| **Installation** | One MCP server per service | One gateway, zero per-service installs |
| **Discovery** | Manual — user must find and install plugins | Automatic — agent searches registry by intent |
| **Context window** | All installed tools loaded at startup | Lazy drill-down — only fetch what you need |
| **Configuration** | Per-service config files, API keys, env vars | One-time setup: "Sign in with Google" + payment method |
| **Scaling** | 10 services = 10 MCP servers running | 10 services = 10 HTTP endpoints (stateless) |
| **For service providers** | Build and maintain an MCP server package | Add one JSON endpoint to your existing API |
| **Auth** | Each MCP server handles its own auth | Centralized OAuth via gateway |
| **Payments** | Out of scope | Built-in via registry marketplace |
| **Portability** | Tied to MCP-compatible agents | Any HTTP client — any agent, any framework |

**MCP is a transport protocol. This is a discovery protocol.** They are complementary. The Gateway MCP is itself an MCP server — it just makes MCP useful at scale.

---

## 6. Implementation Guide

### For Service Providers: Add the Protocol in 10 Minutes

**Step 1.** Create the manifest file. Here's a minimal example:

```json
{
  "spec_version": "1.0",
  "name": "My API",
  "description": "Describe what your API does in 2-3 sentences. Write it like you're explaining to an AI assistant what your service is good for.",
  "base_url": "https://api.yourservice.com",
  "auth": { "type": "api_key", "header": "Authorization", "prefix": "Bearer", "setup_url": "https://yourservice.com/api-keys" },
  "capabilities": [
    {
      "name": "do_something",
      "description": "One sentence explaining what this does.",
      "detail_url": "/capabilities/do_something"
    }
  ]
}
```

**Step 2.** Serve it at `/.well-known/agent`:

```javascript
// Express
app.get('/.well-known/agent', (req, res) => {
  res.json(manifest);
});
```

```python
# FastAPI
@app.get("/.well-known/agent")
def agent_manifest():
    return manifest
```

**Step 3.** Create the capability detail endpoint:

```javascript
app.get('/capabilities/do_something', (req, res) => {
  res.json({
    name: "do_something",
    description: "One sentence explaining what this does.",
    endpoint: "/v1/something",
    method: "POST",
    parameters: [
      { name: "input", type: "string", description: "The input.", required: true, example: "hello" }
    ],
    request_example: { method: "POST", url: "https://api.yourservice.com/v1/something", headers: { "Authorization": "Bearer {token}", "Content-Type": "application/json" }, body: { "input": "hello" } },
    response_example: { status: 200, body: { success: true, data: { "result": "world" } } },
    auth_scopes: [],
    rate_limits: { requests_per_minute: 100 }
  });
});
```

**Step 4.** Register your service in the [Agent Discovery Registry](https://registry.agentdiscovery.dev) (optional but recommended — this is how agents find you).

**That's it.** Your API is now discoverable by any AI agent.

### For Agent Developers: Consume the Protocol

```typescript
// Fetch a service's manifest
const res = await fetch('https://api.example.com/.well-known/agent');
const manifest = await res.json();

// Find a capability
const cap = manifest.capabilities.find(c => c.name === 'send_email');

// Fetch its details (lazy drill-down)
const detailUrl = cap.detail_url.startsWith('http')
  ? cap.detail_url
  : `${manifest.base_url}${cap.detail_url}`;
const detail = await (await fetch(detailUrl)).json();

// Now you have everything: endpoint, method, parameters, examples
// Build the request and call the API
```

Or just use the [Gateway MCP](/gateway-mcp) and let it handle everything.

---

## Examples

See the [`/spec/examples/`](./examples/) directory for complete example manifests:

- [`weather-api.json`](./examples/weather-api.json) — Weather service
- [`email-api.json`](./examples/email-api.json) — Email service
- [`invoicing-api.json`](./examples/invoicing-api.json) — Invoicing service

Each includes detailed capability files showing the full drill-down response.
