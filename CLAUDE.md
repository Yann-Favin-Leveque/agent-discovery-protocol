# Agent Discovery Protocol

## Vision

We are building the "web browser" for AI agents. Today, agents need a separate MCP plugin installed for every service they want to use. We replace all of them with a single gateway.

Three components:
1. **The Spec** — A simple web standard: every service exposes a `/.well-known/agent` endpoint describing its capabilities in natural language + structured JSON. Agents discover services at runtime with lazy drill-down. No installation, no context pollution.
2. **The Registry** — A searchable index of all services implementing the spec. Agents query it to find services by intent ("I need to send an email"). Think DNS, but semantic. Also acts as a marketplace (Stripe Connect) handling subscriptions and payments.
3. **The Gateway MCP** — The only MCP server an agent ever needs. 6 tools: `discover`, `call`, `auth`, `subscribe`, `manage_subscriptions`, `list_connections`. Handles discovery via the registry, OAuth via identity providers (Google/GitHub/Microsoft), and payments via the registry marketplace. Users set up once with "Sign in with Google" + payment method, then never configure anything again.

## Why not MCP?

MCP solves agent-to-service communication but requires installing a separate server per service. This pollutes the agent's context window with tools it doesn't need, creates configuration sprawl, and doesn't scale. Our approach: one gateway, lazy discovery, zero installation per service.

## Architecture
User → Agent → Gateway MCP (one install)
↓
Registry (discovery + auth + payments)
↓
Service A /.well-known/agent → API
Service B /.well-known/agent → API
Service C /.well-known/agent → API

## Monorepo Structure
/spec          — The specification (markdown + JSON examples)
/registry      — Next.js 14 app (App Router, TypeScript, Tailwind, SQLite)
/gateway-mcp   — MCP server (TypeScript, @modelcontextprotocol/sdk)
/docs          — Additional documentation

## Tech Stack

- **Registry**: Next.js 14, App Router, TypeScript, Tailwind CSS, SQLite (better-sqlite3), Stripe Connect
- **Gateway MCP**: TypeScript, @modelcontextprotocol/sdk, node-fetch
- **Design**: Dark mode, monospace accents, developer-focused. Think Stripe docs meets npm registry.

## Conventions

- All code in TypeScript with strict mode
- Use named exports
- Error handling: always graceful, never crash, return meaningful error messages
- API responses follow: `{ success: boolean, data?: any, error?: string }`
- The registry eats its own dog food: it exposes its own `/.well-known/agent` endpoint
- English for all code, docs, and UI

## Key Design Principles

1. **Simplicity over completeness** — The spec fits on one page. If it feels complex, simplify.
2. **Lazy loading** — Agents only fetch what they need (drill-down, not dump-everything)
3. **Web-native** — Just HTTP endpoints. No custom protocols, no WebSocket requirements.
4. **Human in the loop for money** — The agent can never auto-approve payments. Always biometric/PIN confirmation.
5. **Cloud-synced credentials** — Sign in on a new machine, get all your connections back.
6. **Provider-agnostic** — Works with any LLM, any agent framework. Not tied to Anthropic or any provider.
