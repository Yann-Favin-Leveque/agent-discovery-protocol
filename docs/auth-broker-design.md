# Design Document: The Registry as Auth Broker

**Status:** Proposal — open for community discussion
**Authors:** Agent Discovery Protocol team
**Date:** March 2026

---

## The Problem

OAuth was designed for a world where a known set of apps connects to a known set of services. You register your app with Google, get a client ID, and you're done. This model breaks down in the agent economy:

- **Any agent** should be able to access **any service** on behalf of **any user**.
- There are thousands of agents and thousands of services. Each agent registering as an OAuth client with each service is O(agents × services) — it doesn't scale.
- Most agent frameworks have no concept of "registering as an OAuth client." They're ephemeral processes, not deployed web apps.
- MCP solves agent-to-service communication but punts on multi-service auth. Each MCP server manages its own tokens independently.

The result: users manually copy-paste API keys into config files, agents can't discover and connect to new services at runtime, and there's no centralized way to audit or revoke access.

## Proposed Solution: Auth Broker

The registry becomes a single OAuth client that brokers authentication between agents and services. Think of it as "Login with AgentDNS" — but for machines.

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Agent   │────▶│   Registry   │────▶│  Service A   │
│(Gateway) │     │ (Auth Broker)│     │  (OAuth)     │
└──────────┘     │              │     └──────────────┘
                 │  • One OAuth │     ┌──────────────┐
  ┌──────────┐   │    client    │────▶│  Service B   │
  │   User   │──▶│  • Token     │     │  (API key)   │
  │(Browser) │   │    vault     │     └──────────────┘
  └──────────┘   │  • Audit log │     ┌──────────────┐
                 │  • Payments  │────▶│  Service C   │
                 └──────────────┘     │  (OAuth)     │
                                      └──────────────┘
```

### How It Works

#### 1. Service providers register once

When a service submits to the registry, they optionally provide OAuth client credentials that the registry can use on behalf of users:

```json
{
  "auth": {
    "type": "oauth2",
    "authorization_url": "https://api.example.com/oauth/authorize",
    "token_url": "https://api.example.com/oauth/token",
    "scopes": ["read", "write"],
    "broker": {
      "client_id": "agentdns_broker_xxxxx",
      "allowed_scopes": ["read", "write"],
      "max_token_lifetime": 3600
    }
  }
}
```

The service creates a single OAuth client for the registry, rather than for each agent individually. This is a one-time setup.

For services that support [Dynamic Client Registration (RFC 7591)](https://www.rfc-editor.org/rfc/rfc7591), the registry can register itself automatically — no manual step needed.

#### 2. Users link accounts through the registry

When a user first connects to a service through the gateway:

```
Agent: "I need to send an email via MailForge."
Gateway: "You're not connected to MailForge. Connect now?"
User: "Yes"
→ Browser opens: registry auth page
→ Registry redirects to MailForge OAuth
→ User approves scopes
→ MailForge issues tokens to the registry (as the OAuth client)
→ Registry stores tokens, encrypted at rest
→ User returns to agent
Agent: "Connected. Sending your email now."
```

The user never interacts with the agent's OAuth flow. The registry handles it, the same way Chrome handles passwords — the user links once, and it works everywhere.

#### 3. Agents request scoped tokens through the gateway

When an agent needs to call a service, it doesn't get the user's actual OAuth token. Instead:

```
Agent → Gateway: "I need a token for MailForge, scope: send_email"
Gateway → Registry: "User X wants scope send_email on MailForge, agent is Claude"
Registry:
  1. Verifies user X has linked MailForge
  2. Checks requested scopes are within user's approved scopes
  3. Checks agent trust level allows this scope
  4. Issues a short-lived, scoped token (or proxied request)
Registry → Gateway: { token: "ey...", expires_in: 3600, scopes: ["send_email"] }
Gateway → Service: API call with scoped token
```

The agent never sees the user's long-lived OAuth token. It gets a short-lived, minimally-scoped token for exactly what it needs.

#### 4. Token exchange options

Two models, depending on service support:

**Model A: Token Exchange (RFC 8693)**
The registry exchanges the user's stored token for a short-lived, downscoped token via the service's token endpoint. The agent gets a real service token, but with reduced scope and lifetime.

```
POST /oauth/token
grant_type=urn:ietf:params:oauth:grant-type:token-exchange
subject_token=<user's stored token>
scope=send_email
requested_token_type=urn:ietf:params:oauth:token-type:access_token
```

**Model B: Proxied Requests**
The registry proxies the API call itself, injecting the user's token server-side. The agent never receives any token — it just gets the API response.

```
Agent → Registry: "Call POST /v1/messages/send on MailForge with these params"
Registry → MailForge: (injects stored token, makes the call)
Registry → Agent: "Here's the response"
```

Model B is more secure (tokens never leave the registry) but adds latency and makes the registry a single point of failure.

**Recommendation:** Support both. Default to Model A where services support RFC 8693, fall back to Model B for services that don't. Let service providers choose their preference in the manifest.

## Security Model

### Principle of Least Privilege

Every token issued by the broker follows minimum-scope:

```
User approved scopes:  [read, write, admin]
Agent requested scopes: [write]
Agent trust level max:  [read, write]
───────────────────────────────────────
Issued token scopes:   [write]  ← intersection
```

The issued token gets the **intersection** of:
- What the user approved for this service
- What the agent requested
- What the agent's trust level allows

### Token Lifetimes

| Token Type | Lifetime | Refresh |
|------------|----------|---------|
| User's stored token | Long-lived (service decides) | Auto-refresh via refresh_token |
| Agent-issued token | 1 hour (default) | Re-request from registry |
| Proxy session | Per-request | N/A |

The 1-hour default for agent tokens is a balance between usability (not re-requesting every call) and security (limiting blast radius of compromised tokens). Service providers can override this in the `broker.max_token_lifetime` field.

### Agent Trust Levels

Not all agents are equal. A verified, audited agent should get more access than an unknown script:

| Level | Description | Max Scopes | Rate Limit |
|-------|-------------|------------|------------|
| `verified` | Published, audited agent (e.g., Claude, GPT) | All user-approved scopes | High |
| `registered` | Known agent with registry account | Read + write scopes | Medium |
| `anonymous` | Unknown agent, no registry account | Read-only scopes | Low |

Trust levels are assigned based on:
- Agent registration with the registry (identity verification)
- Community reputation (usage, reports, reviews)
- Security audit status (optional, for highest tier)

### User Revocation

Users can revoke access instantly:

- **Per-service:** "Disconnect MailForge" → all tokens for that service are invalidated
- **Per-agent:** "Revoke Claude's access" → all tokens issued to Claude are invalidated
- **Global:** "Disconnect everything" → nuclear option, all tokens revoked

Revocation is immediate. The registry maintains a revocation list that agents and services check. For Model B (proxied), revocation is instant since the registry controls the token. For Model A (token exchange), the registry signals the service to revoke the downscoped token.

Revocation interfaces:
- Registry dashboard (web UI)
- Gateway MCP tool: `manage_connections({ domain: "...", action: "revoke" })`
- API endpoint: `DELETE /api/connections/{domain}`

### Audit Log

Every token issuance and API call (in Model B) is logged:

```json
{
  "event": "token_issued",
  "timestamp": "2026-03-01T14:30:00Z",
  "user_id": "usr_abc",
  "service": "api.mailforge.dev",
  "agent": "claude-desktop",
  "scopes_requested": ["send_email"],
  "scopes_issued": ["send_email"],
  "token_lifetime": 3600,
  "agent_trust_level": "verified"
}
```

Users can view their audit log on the registry dashboard. This provides transparency into what agents are doing on their behalf — something completely absent from the current MCP model.

## Payment Integration

The auth broker naturally extends to payments. The registry already knows the user's identity and the service's pricing:

```
Agent: "Create an invoice on InvoiceNinja"
Gateway → Registry: "User X wants to call create_invoice on InvoiceNinja (paid service)"
Registry:
  1. Checks user has active subscription OR pay-per-use enabled
  2. If first time: sends push notification for payment approval
  3. User approves with biometric (Face ID / fingerprint / PIN)
  4. Registry charges via Stripe Connect
  5. Issues scoped token for the capability
```

### Payment Flow

```
┌──────────┐     ┌──────────────┐     ┌──────────────┐
│  Agent   │────▶│   Registry   │────▶│   Stripe     │
│          │     │              │     │  Connect     │
│ "subscribe│     │  • Validate  │     └──────────────┘
│  to Pro" │     │  • Confirm   │            │
└──────────┘     │  • Charge    │◀───────────┘
                 │  • Issue     │     ┌──────────────┐
  ┌──────────┐   │    token     │────▶│   Service    │
  │   User   │──▶│              │     │              │
  │ (Phone)  │   └──────────────┘     └──────────────┘
  │ "Approve │
  │  $29/mo" │
  └──────────┘
```

### Key Principles

1. **Human in the loop for money.** The agent can never auto-approve a payment. Every financial transaction requires explicit user confirmation via biometric or PIN.

2. **Transparent pricing.** The agent sees pricing from the manifest and relays it to the user before any purchase. No hidden fees.

3. **Registry fee.** The registry takes a small transaction fee (e.g., 5-10%) via Stripe Connect. This is the business model — the protocol is open, the registry is the value-add.

4. **Service providers get paid directly.** Stripe Connect means the registry never holds service provider funds. Payments go directly to the provider's Stripe account, minus the platform fee.

## Open Questions

These are unsolved problems. We're publishing them to invite community input.

### 1. Services without OAuth support

Many APIs only support API keys. The broker model doesn't apply directly — you can't downscope an API key or exchange it for a short-lived token.

**Options under consideration:**
- **Proxy-only mode:** The registry stores the API key and proxies all calls. The agent never sees the key.
- **Wrapper service:** The registry wraps the API behind its own OAuth layer. Adds complexity.
- **Pass-through:** For API key services, fall back to the current model (agent stores key locally). Less secure, but pragmatic.

### 2. Dynamic Client Registration (RFC 7591)

For services that support it, the registry could register itself automatically:

```
POST /oauth/register
{
  "client_name": "AgentDNS Registry",
  "redirect_uris": ["https://agentdns.dev/auth/callback"],
  "grant_types": ["authorization_code", "refresh_token"],
  "token_endpoint_auth_method": "client_secret_basic"
}
```

This would eliminate the manual step of service providers creating OAuth credentials for the registry. But adoption of RFC 7591 is limited. Should we require it? Recommend it? Ignore it?

### 3. Preventing token abuse by malicious agents

A malicious agent could request tokens and misuse them (exfiltrating data, performing unauthorized actions within approved scopes).

**Mitigation ideas:**
- Rate limiting per agent per service
- Anomaly detection on API call patterns
- Agent reputation scoring based on user reports
- Mandatory audit logs that users can review
- Ability for services to block specific agents

But none of these fully prevent a trusted agent from going rogue. This is fundamentally a trust problem, not a technical one. Is the registry the right entity to solve it?

### 4. Liability for unauthorized purchases

If an agent makes a purchase on behalf of a user, who is liable if it's unwanted?

- The agent developer? (They wrote the code that decided to purchase)
- The user? (They approved the agent's access)
- The registry? (It brokered the transaction)
- The service provider? (They charged the user)

We enforce biometric confirmation to reduce this risk, but it doesn't eliminate it (e.g., the agent could mislead the user about what they're approving). This needs legal clarity, probably per jurisdiction.

### 5. Privacy of API call data

In Model B (proxied requests), the registry sees every API call and response. This is a significant privacy concern:

- Can the registry log or analyze API call content?
- What data retention policies apply?
- What if a government requests access to the audit log?
- Should the registry offer an end-to-end encrypted mode?

**Our current position:** The registry logs metadata (timestamp, service, scopes, agent) but NOT request/response bodies. But this is a policy choice, not a technical guarantee. End-to-end encryption would provide a stronger guarantee but would prevent the registry from validating or rate-limiting calls.

## Comparison

| | Auth Broker (this proposal) | Auth0 | MCP Auth | Zapier |
|---|---|---|---|---|
| **Designed for** | AI agents accessing any API | Human-facing apps | Single-service agent auth | Workflow automation |
| **Client registration** | Once (registry is the client) | Per-app per-service | Per-MCP-server | Closed platform |
| **Multi-service** | Yes (core design) | Yes (but app-centric) | No (one server = one service) | Yes (closed ecosystem) |
| **Token scoping** | Per-request, least privilege | Per-app | Per-server | Per-workflow |
| **Agent trust** | Trust levels, reputation | N/A | N/A | Platform-controlled |
| **Audit log** | Built-in, user-visible | Enterprise feature | None | Per-workflow logs |
| **Payments** | Integrated (Stripe Connect) | No | No | Paid platform |
| **Open protocol** | Yes | No | Yes (protocol, not auth) | No |
| **User revocation** | Instant, granular | Per-app | Manual token deletion | Per-connection |

### vs. Auth0

Auth0 solves "my app needs to authenticate users." The auth broker solves "any agent needs to access any service on behalf of any user." Auth0 requires each app to register as a client. The broker eliminates per-agent registration entirely.

### vs. MCP Auth

MCP is a communication protocol, not an auth solution. Each MCP server manages its own tokens independently. There's no way to revoke all tokens, audit agent activity across services, or manage subscriptions. The auth broker adds the missing auth layer.

### vs. Zapier

Zapier provides similar functionality (connect once, use everywhere) but in a closed ecosystem. You can only use Zapier-approved integrations, and Zapier controls the platform. The auth broker is an open protocol — anyone can run a registry, and services self-register by adding an endpoint.

## What This Document Is Not

This is not a specification. It's a design document meant to start a conversation. The ideas here are preliminary and will evolve based on community feedback.

**What we need:**
- Security review from auth/identity experts
- Feedback from service providers: would you register OAuth credentials with a third-party broker?
- Feedback from agent developers: what token model works best for your use case?
- Legal perspective on liability and privacy
- Input on the trust level system

Open issues and PRs at [github.com/Yann-Favin-Leveque/agent-discovery-protocol](https://github.com/Yann-Favin-Leveque/agent-discovery-protocol).

---

*This document is part of the [Agent Discovery Protocol](../spec/README.md) project — an open standard for making APIs discoverable by AI agents.*
