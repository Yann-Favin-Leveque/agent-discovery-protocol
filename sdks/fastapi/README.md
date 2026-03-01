# agent-well-known-fastapi

FastAPI integration for the [Agent Discovery Protocol](https://github.com/user/agent-discovery-protocol). Add two lines of code and your API becomes discoverable by any AI agent at runtime -- no plugins, no installation, no configuration on the agent side.

This package serves the `/.well-known/agent` manifest and per-capability detail endpoints as defined by the [spec v1.0](https://github.com/user/agent-discovery-protocol/tree/main/spec).

## Installation

```bash
pip install agent-well-known-fastapi
```

## Quick Start

```python
from fastapi import FastAPI
from agent_well_known import AgentManifest, Capability

manifest = AgentManifest(
    name="My API",
    description="What my API does, described in 2-3 sentences for an LLM.",
    base_url="https://api.example.com",
    auth={
        "type": "api_key",
        "header": "Authorization",
        "prefix": "Bearer",
        "setup_url": "https://example.com/api-keys",
    },
    capabilities=[
        Capability(
            name="send_email",
            description="Send an email to one or more recipients.",
            endpoint="/api/emails",
            method="POST",
            parameters=[
                {
                    "name": "to",
                    "type": "string",
                    "required": True,
                    "description": "Recipient email address.",
                    "example": "alice@example.com",
                },
                {
                    "name": "subject",
                    "type": "string",
                    "required": True,
                    "description": "Email subject line.",
                    "example": "Hello",
                },
                {
                    "name": "body",
                    "type": "string",
                    "required": True,
                    "description": "Email body text.",
                    "example": "Hi there!",
                },
            ],
            auth_scopes=["email.send"],
            rate_limits={"requests_per_minute": 60},
        ),
    ],
)

app = FastAPI()
manifest.mount(app)
```

That's it. Your API now exposes:

| Endpoint | Description |
|----------|-------------|
| `GET /.well-known/agent` | Top-level manifest (capabilities summary) |
| `GET /.well-known/agent/capabilities/send_email` | Full detail for the `send_email` capability |

## Configuration Reference

### `AgentManifest`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `str` | Yes | Human-readable service name. |
| `description` | `str` | Yes | 2-3 sentences describing the service for an LLM. |
| `base_url` | `str` | Yes | Base URL for all API calls. |
| `auth` | `dict` | Yes | Auth config: `oauth2`, `api_key`, or `none` (see below). |
| `pricing` | `dict` | No | Pricing information (see spec). |
| `capabilities` | `list[Capability]` | Yes | At least one capability. |

### Auth Types

**API Key:**

```python
auth={
    "type": "api_key",
    "header": "Authorization",
    "prefix": "Bearer",
    "setup_url": "https://example.com/api-keys",
}
```

**OAuth 2.0:**

```python
auth={
    "type": "oauth2",
    "authorization_url": "https://auth.example.com/authorize",
    "token_url": "https://auth.example.com/token",
    "scopes": ["read", "write"],
}
```

**None (public API):**

```python
auth={"type": "none"}
```

### `Capability`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | `str` | Yes | Machine-readable identifier (snake_case). |
| `description` | `str` | Yes | 1-2 sentences for LLM understanding. |
| `endpoint` | `str` | Yes | API path relative to `base_url`. |
| `method` | `str` | Yes | `GET`, `POST`, `PUT`, `PATCH`, or `DELETE`. |
| `parameters` | `list[dict]` | Yes | Parameter definitions (see below). |
| `request_example` | `dict` | No | Complete example request. Auto-generated if omitted. |
| `response_example` | `dict` | No | Complete example response. |
| `auth_scopes` | `list[str]` | No | Auth scopes required for this capability. |
| `rate_limits` | `dict` | No | Rate-limiting info. |

### Parameter Dict

Each parameter in the `parameters` list must contain:

| Key | Type | Description |
|-----|------|-------------|
| `name` | `str` | Parameter name. |
| `type` | `str` | Type: `string`, `number`, `boolean`, `object`, `string[]`, `object[]`. |
| `required` | `bool` | Whether this parameter is required. |
| `description` | `str` | What this parameter does. |
| `example` | `any` | Example value. |

## What Gets Generated

### `GET /.well-known/agent`

Returns the manifest with `spec_version: "1.0"`, your service metadata, and a lightweight summary of each capability with a `detail_url` pointing to the detail endpoint.

Response headers include `Access-Control-Allow-Origin: *` and `Cache-Control: public, max-age=3600` as recommended by the spec.

### `GET /.well-known/agent/capabilities/{name}`

Returns the full capability detail including endpoint, method, parameters, request/response examples, auth scopes, and rate limits.

If `request_example` was not provided when creating the `Capability`, one is auto-generated from `base_url`, `endpoint`, `method`, `parameters`, and `auth`.

Returns 404 if the capability name does not exist.

## Optional: Pricing

```python
manifest = AgentManifest(
    ...,
    pricing={
        "type": "freemium",
        "plans": [
            {"name": "Free", "price": "$0/mo", "limits": "100 requests/day"},
            {"name": "Pro", "price": "$19/mo", "limits": "Unlimited"},
        ],
        "plans_url": "https://example.com/pricing",
    },
)
```

## Links

- [Agent Discovery Protocol Specification](https://github.com/user/agent-discovery-protocol/tree/main/spec)
- [Agent Discovery Registry](https://registry.agentdiscovery.dev)
- [Express SDK](https://www.npmjs.com/package/agent-well-known-express)

## License

MIT
