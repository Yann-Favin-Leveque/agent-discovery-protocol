# Design Doc: Unified Billing Pivot — v1

**Status:** Design locked, ready for implementation
**Date:** 2026-04-28
**Supersedes:** payments sections of `auth-broker-design.md`. Auth broker patterns (OAuth-as-broker, scoped tokens, audit log) remain valid.

---

## TL;DR

We pivot from a marketplace registry (each provider is its own merchant, users pay each provider via Stripe Connect) to a **single-tenant aggregator** (we are the customer of every provider; users pay only us; one card unlocks everything).

Why: the current model required 242 providers to onboard their own Stripe Connect account before users could pay them — a chicken-and-egg blocker. Single-tenant lets us launch with ~25 carefully-chosen services we control end-to-end.

Trade-off: we take on the role of payment intermediary and reseller. Per a ToS audit (`docs/tos-audit.md`), 91% of indexed services tolerate this model; the 9 hard-RED services are excluded from v1.

---

## 1. The user flow (plug-and-play target)

```
1. User installs MCP:           npm install -g agent-gateway-mcp
2. User runs:                   agent-gateway config
                                → opens local web page in browser
                                → "Sign in with Google"
                                → "Add a card" (Stripe Elements)
                                → toggles services on/off
                                → OAuth flow per service (lazy: only when toggling on,
                                  or at first call if user skipped)
3. User adds MCP to Claude/Cursor/etc:
   { "mcpServers": { "gateway": { "command": "agent-gateway-mcp" } } }
4. User talks to agent.         Agent calls services. It just works.
```

**Setup time, first install:** ~2 minutes (sign in + card + 3-5 services toggled).
**Setup time, every other day:** zero.

The card is added once. Period.

---

## 2. MCP behavior

### Tools exposed (3, down from 6)

| Tool | Purpose | Notes |
|------|---------|-------|
| `discover` | Browse + search the catalog | Multi-mode (search / domain / capability detail) |
| `call` | Execute a capability | Auto-handles auth (OAuth refresh, key injection) |
| `list_connections` | Show what's enabled and connected | For the agent's situational awareness |

**Removed:** `auth`, `subscribe`, `manage_subscriptions`. Reasoning:
- `auth` removed because all auth setup happens in `agent-gateway config` (browser-based) or is auto-triggered by `call` when needed. The agent never collects credentials directly.
- `subscribe` and `manage_subscriptions` removed because **the user has no plans to manage**. In single-tenant, users don't subscribe to anything — they consume APIs pay-per-use and we send them an invoice for the month. There is nothing to "subscribe" to.

### Default behavior: enabled-only

`discover` by default returns **only services the user has enabled** in their config. This is the key behavior change from today's code, which exposes all 242 services regardless.

```
discover()                       → top-8 enabled services, by usage + popularity
discover(query="send email")     → enabled services matching the intent
discover(domain="api.x.com")     → manifest of x, only if enabled
discover(query=..., browse_catalog=true)
                                 → searches the full catalog (242), but each result
                                   is marked [NOT ENABLED] and cannot be called
```

If the user wants a service that isn't enabled, the agent searches with `browse_catalog=true`, finds it, and tells the user *in conversation*: "X is in the catalog but not enabled. Run `agent-gateway config` to enable it." The agent never runs config itself — that is a human-only step (touches money + browser auth).

### Top-K cold-start

`discover()` with no args returns the user's top-8 enabled services, ordered by:
1. Most-used by this user (locally tracked usage)
2. Tie-break: `popularity_score` (manually editorialized, 0-100, set by us during onboarding)

The MCP description embeds a brief reminder of what's enabled so the agent has context without calling any tool. Example description tail:
> "Currently enabled for this user: gmail, stripe, github, notion, slack (and 3 more). Use `discover()` to list all enabled, or `discover(query=...)` to search."

### Empty-state handling

If 0 services are enabled, every `discover` call returns:
> "No services enabled yet. The user must run `agent-gateway config` in a terminal to sign in, add a payment method (for paid services), and toggle services on. Once done, services will appear here automatically."

This is critical: without it, the agent gets "no results" and reformulates queries forever instead of telling the user the actual problem.

### Call on a non-enabled service

```
call(domain="api.openai.com", capability="chat", ...)
  → if enabled:    proceed normally
  → if not enabled: error, "Service api.openai.com is not enabled.
                            Ask the user to run `agent-gateway config` and enable it."
  → if enabled but no auth yet: gateway auto-triggers OAuth (opens browser)
                                or opens the local config page if a manual API key
                                is required for this service.
```

The auto-trigger from `call` replaces the old `auth` tool's main use case.

---

## 3. The CLI: `agent-gateway config`

Single command that opens a **local web page** (mini HTTP server on `localhost:9876`, browser auto-opened — same pattern as `gh auth login`, `vercel login`, and our existing `agent-gateway init`).

**Why a local web page and not a CLI form:** OAuth flows, Stripe Elements (card input), and toggle UIs are all dramatically better in a real browser. The page is served by the gateway itself, no remote auth needed because the user is physically at the keyboard.

### What the page does

- Sign in with Google (OAuth → registry session)
- Add / change payment method (Stripe Elements)
- List of enableable services with toggles:
  - **Toggle ON, OAuth-supported** → triggers OAuth flow inline, captures tokens
  - **Toggle ON, BYO key required** → shows setup_guide + paste-key field
  - **Toggle OFF** → revokes access immediately
- Per-service spending caps (e.g. "max 10€/month on OpenAI")
- Local-machine usage view: this month's consumption based on what this client has spent
- Link to Stripe Customer Portal for full invoices and payment history
- Delete account (revokes everything)

> **v1 note on usage view:** the in-page usage display only aggregates events from **this machine**. Users running the gateway on multiple machines (laptop + desktop) will see partial counts. Cross-machine aggregation is a v2 feature — it requires server-side usage events posted from every gateway instance, which adds backend complexity we don't need at launch.

### Why no `subscribe` / `manage_subscriptions` even as CLI commands

The user has no plans, no tiers, no upgrades. They have a card and a list of toggles. Everything is in `agent-gateway config`. A separate `agent-gateway subscriptions` command would have nothing to manage.

If we add Notion-Plus-style tier-based services later (see §5), they'll be configured in `agent-gateway config` like everything else.

---

## 4. Architecture

### Schema changes

**Keep as-is:**
- `services`, `capabilities`, `categories` — unchanged
- `users` — keep, but `stripe_customer_id` now points to *our* customer (we are the merchant), not Stripe Connect
- `oauth_clients` — keep (provider-specific OAuth credentials, owned by us, used to broker user auth)

**Drop:**
- `provider_accounts` — Stripe Connect provider onboarding is irrelevant in single-tenant
- `subscriptions` — no per-user-per-service subscriptions exist anymore
- (the dependent code in `lib/stripe.ts`: `createConnectAccount`, `createConnectAccountLink`, `createSubscription`, `cancelSubscription`, `changeSubscriptionPlan`, `application_fee_percent`, `transfer_data` — all dead)

**Repurpose:**
- `transactions` → rename to `usage_events`, schema changes (see below)

**New tables:**

```sql
-- Our credentials with each provider (the account WE own on their side)
CREATE TABLE service_credentials (
  service_id INT PRIMARY KEY REFERENCES services(id),
  credential_type TEXT,           -- 'api_key' | 'oauth_token' | 'basic'
  credential_blob BYTEA,           -- encrypted at rest
  unit TEXT,                       -- 'call' | 'token' | 'mb' | 'minute'
  our_unit_cost_cents NUMERIC,     -- what the provider charges us per unit
  free_quota_monthly INT,          -- units/month the provider gives us free, NULL=unknown
  last_rotated_at TIMESTAMPTZ
);

-- User's per-service enable toggle + spending cap
CREATE TABLE user_service_enablement (
  user_id INT REFERENCES users(id),
  service_id INT REFERENCES services(id),
  enabled BOOLEAN DEFAULT true,
  monthly_cap_cents INT,           -- user's spending cap, NULL=no cap
  byo_credential_blob BYTEA,        -- encrypted, set when user provides their own key
                                   -- NULL when service uses our shared credentials
  enabled_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, service_id)
);

-- Per-call usage tracking (replaces transactions)
CREATE TABLE usage_events (
  id BIGSERIAL PRIMARY KEY,
  user_id INT,
  service_id INT,
  capability_name TEXT,
  units NUMERIC,                   -- e.g. tokens, or 1 for per-call
  user_charge_cents NUMERIC,       -- what we charge the user
  our_cost_cents NUMERIC,          -- what the provider charges us
  occurred_at TIMESTAMPTZ DEFAULT NOW(),
  invoiced BOOLEAN DEFAULT false,
  stripe_invoice_id TEXT
);

-- What we charge users per service/capability/unit (with markup or passthrough)
CREATE TABLE service_pricing (
  service_id INT REFERENCES services(id),
  capability_name TEXT,            -- NULL = applies to all capabilities of this service
  unit TEXT,
  user_price_cents NUMERIC,        -- price per unit charged to user
  free_units_per_month INT,        -- our free tier offered to user
  effective_from TIMESTAMPTZ
);

-- Editorial popularity score for cold-start tool ranking (manual in v1)
ALTER TABLE services ADD COLUMN popularity_score INT DEFAULT 0;
```

Indexes critical for billing job:
- `usage_events(user_id, occurred_at, invoiced)` — monthly invoice generation
- `usage_events(service_id, occurred_at)` — provider-side reconciliation

### Stripe usage (drastically reduced)

We keep ~30 lines from `lib/stripe.ts`:
- `getStripe()` (singleton)
- `createCustomer()` (when user signs up)
- `createSetupIntent()` (when user adds card)
- `constructWebhookEvent()` (for invoice + payment events)

We **add** invoice generation logic:
- Monthly cron: for each user with non-invoiced usage_events, call `stripe.invoiceItems.create` per line, then `stripe.invoices.create` + `finalizeInvoice` + auto-charge.
- Webhook handlers for `invoice.paid` and `invoice.payment_failed`.

We **drop** all Stripe Connect code (createConnectAccount, account links, account.updated webhooks) and all subscription code (createSubscription, change/cancel, customer.subscription.* webhooks).

The Connect code is **deleted, not feature-flagged.** It can be resurrected from git if a future "premium provider" model brings back marketplace mechanics. Keeping dead code in the repo bloats the surface area for v1.

### Per-call flow

```
1. Agent → Gateway: call(service="api.openai.com", capability="chat_completions", {...})
2. Gateway checks local cache: is service enabled for user? → yes/no
3. Gateway → Registry: POST /api/usage/authorize {user_id, service_id, est_cost_cents}
   - Registry verifies: card on file, not over monthly_cap, not exceeding rate limits
   - Returns: ALLOW (with our credentials decrypted) or DENY (with reason)
4. Gateway calls provider with our credentials.
   - For ORANGE-tier services that support it: pass `user` field set to user's UUID.
5. Provider responds.
6. Gateway → Registry: POST /api/usage/report {user_id, service_id, units, capability}
   - Registry computes user_charge_cents and inserts a usage_event.
7. End of month: cron generates Stripe invoice from un-invoiced events.
```

Steps 3 and 6 must be cheap (<10ms p99) or every call gets a tax. The first version uses simple Postgres queries; we add Redis caching only if profiling shows it matters.

---

## 5. Three service tiers

Per `docs/tos-audit.md` of the 242 indexed services:

### 🟢 GREEN — explicit reseller-friendly (41 services)

Examples: Stripe, Twilio, SendGrid, Mapbox, Cloudflare, Algolia, Replicate, Groq, Together, Resend, Mailgun, Postmark, Square, Mollie, Paddle.

Treatment: we hold the account. User toggles on, we use our credentials. We charge the user with markup (10-20% above our cost). Standard.

### 🟡 ORANGE — silent or ambiguous, passthrough tolerated (144 services)

Examples: OpenAI, Anthropic, Cohere, Notion, Airtable, Salesforce, Slack, GitHub, most per-tenant SaaS via OAuth.

Treatment: we hold the account, but we follow "good citizen passthrough" rules:
- Pass the user's UUID in the provider's user-identification field whenever supported (`user` field for OpenAI, `metadata.user_id` for Anthropic, similar for others).
- Reasonable markup only (no 5x rebrand pricing — that's what triggers ToS enforcement).
- Honor any provider's per-user moderation / abuse signals.
- Acceptable Use Policy (AUP) covering content, spam, and fraud (see §7).

### 🔴 RED — reseller forbidden / formal partnership required (9 services)

Spotify, LinkedIn, Plaid, Shopify, CoinMarketCap Pro, Google Ads, Twitter/X Ads, Meta Marketing, Instagram business endpoints.

Treatment: **excluded from v1.** Optionally add later as **BYO-key only** services (user provides their own API key, we don't touch billing). For v1, simpler to leave them out entirely.

### ⚪ N/A — free-only (35 services)

No billing concern. Toggleable freely, OAuth where applicable.

### Tier-based services (Notion Plus, Slack Pro, Airtable Plus)

These don't fit pay-per-use cleanly because they charge a flat monthly per-seat price. For v1, we treat the **API access** of these as ORANGE (per OAuth, free tier or pay-per-API-call where applicable) and we **don't try to bundle the seat license**. If a user wants Notion Plus features, they buy Notion Plus directly from Notion — we just call Notion's API for them.

This avoids the complexity of "do I pay Notion $8/month per user even if they make 1 API call?" — that's a v3 problem.

### v1 launch list (25 services)

From the audit:
- **LLMs:** OpenAI, Anthropic, Mistral, Groq, Replicate, Deepgram
- **Comms:** Gmail, Slack, Twilio, SendGrid, Resend, Telegram
- **Productivity:** Google Calendar, Notion, GitHub, Trello, Calendly, Cal.com
- **Infra:** Stripe, Cloudflare R2, Mapbox, Algolia
- **Misc:** OpenWeatherMap, DeepL, DocSpring

Excluded: the 9 hard-RED services. Everything else from the catalog stays as discovery-only (visible via `browse_catalog=true` in `discover`) until we onboard them as paid v1+.

---

## 6. Bootstrap (it's mostly on us)

The big work is **operational**, not technical, for v1:

1. **OAuth apps:** for each of the ~20 services in v1 that support OAuth, register an "AgentDNS" OAuth app on the provider's developer console. Capture `client_id` + `client_secret`, store in `oauth_clients`. Provider doesn't need to know we exist — we look like any other OAuth-using app.
2. **Paid accounts:** open developer/business accounts on the ~10 paid services in v1 (OpenAI, Anthropic, Twilio, etc.). Add a card to each. Capture API credentials, encrypt, store in `service_credentials`.
3. **Pricing config:** for each paid service, fill in `service_pricing` rows (passthrough cost + 15% markup is a sane default).
4. **Manual popularity scores:** set `popularity_score` on the v1 services so cold-start ordering reflects perceived usefulness.
5. **AUP page:** publish acceptable-use policy on the registry website (§7).
6. **Stripe Customer Portal config:** enable the portal in Stripe dashboard, link from `agent-gateway config`.

None of this requires partnership negotiations. We can ship v1 entirely on our own initiative, no provider needs to opt in.

---

## 7. Abuse & ban risk

The risk profile, by service type:

| Risk | Affected services | Mitigation |
|------|-------------------|------------|
| Spam outbound | Email/SMS (SendGrid, Twilio, Mailgun, Resend) | Per-user outbound quotas at gateway. Pattern detection (repeated recipient domains). |
| Generated-content abuse | LLMs, image/audio gens (OpenAI, Anthropic, Replicate) | Pass `user` field to provider — they handle moderation per-user. Optional: pre-call OpenAI moderation API (free). |
| Rate-limit hammering | All | Per-user sliding-window rate limit at gateway, conservative defaults (e.g. provider_limit / 100). |
| Fraud / chargebacks | Payment side | Stripe Radar (built-in), 3DS on first charge. |
| Account takeover | All | OAuth on our side with MFA encouraged. |
| Provider bans **us** | Mostly LLMs and email | (See below) |

**The asymmetric risk: the provider bans our account, all users lose the service.**

This is the only structurally scary case. It's almost exclusively a concern for LLMs and outbound-comm services. Mitigations:
- Pass `user` field everywhere it's supported — providers ban *individual* users, not our whole account, when they can identify abuse.
- AUP with hard suspension clauses — we cut off a user the moment they cause problems.
- Outbound quotas + content moderation pre-call where supported.
- Multi-account fallback (longer term): if banned, switch to a backup credential.

For services where we have no `user` passthrough field and no per-user moderation, we accept higher risk — and we keep those services on a short list we monitor manually.

### AUP (to be drafted in parallel)

A single short page on the registry website covering:
- No spam (email, SMS, comments)
- No generated content that violates provider ToS (CSAM, violence-incitement, etc.)
- No scraping at abusive rates
- No fraud (stolen cards, identity)
- We reserve the right to suspend a user for any provider-ban-causing behavior, no refund

This protects us legally and gives us the right to cut off bad actors. Drafted as a separate `docs/aup.md`.

---

## 8. Open questions

### Q1. Markup vs subscription
**Default for v1: passthrough + flat 15% markup on usage, no monthly subscription.** Reasoning: subscriptions add friction for casual users; markup is invisible if reasonable.

**Open:** at what user volume does a "subscription with included usage" become more attractive? Probably at >$30/month of consumption. Punt to v2.

### Q2. Expose our cost to users
**Default for v1: show user_price only, hide our_cost.** Markup is normal practice (Stripe, AWS Marketplace, etc.). Transparent disclosure of markup % in the AUP/pricing page is enough.

### Q3. Cross-machine usage aggregation
**Default for v1: not supported.** `agent-gateway config` shows local-machine usage only. The accurate billing data lives server-side (registry's `usage_events` table); the user can see it via Stripe Customer Portal once invoiced.

**v2:** add a `/api/users/me/usage` endpoint that returns server-aggregated month-to-date usage, displayed in `agent-gateway config`.

### Q4. Identity passthrough as default
**Default for v1: yes, pass user UUID** in any provider field that supports it (OpenAI `user`, Anthropic `metadata.user_id`, etc.). Provider abuse tracking is too valuable to skip.

**Open:** which providers support what field? Needs a per-service `user_id_field` in `service_credentials` config.

### Q5. Rate-limit policy on provider free quotas
**Default for v1: first-come-first-served** with per-user sliding window. If provider free quota exhausted, paid users continue (we pay), free users get 429-ish error.

**Open:** fair-share quotas across users? Probably v2.

---

## 9. Migration plan

The current code is a working marketplace registry. The pivot is a meaningful refactor but bounded:

1. **Schema migration** (one PR): add new tables (`service_credentials`, `user_service_enablement`, `service_pricing`, `usage_events`), add `popularity_score` column. Don't touch existing tables yet.
2. **Backfill** `service_credentials` rows for the 25 v1 services with our actual API keys (encrypted). Manual ops work.
3. **Gateway changes** (one PR per concern):
   - Default `discover` to enabled-only with `browse_catalog` opt-in.
   - Add cold-start `discover()` returning top-K.
   - Add empty-state message for 0-enabled.
   - Remove `auth`, `subscribe`, `manage_subscriptions` tools.
   - Add usage authorize + report calls around every `call`.
4. **Registry API changes**:
   - New endpoints: `/api/usage/authorize`, `/api/usage/report`, `/api/users/me/enablement`.
   - Update `agent-gateway config` web page to manage toggles + caps.
   - Build invoice generation cron.
5. **Drop dead code**: remove Stripe Connect routes/lib, drop `provider_accounts` and `subscriptions` tables (after a final backup).
6. **Deploy v1**: card flow, 25 services, AUP published, monitoring in place.

Estimate: ~3-4 weeks of focused work, gated by paid-account onboarding which can run in parallel.

---

## 10. What we are *not* doing in v1

- Multi-agent toggles (different services for different agents owned by same user)
- Cross-machine usage aggregation in the CLI
- Subscription tiers / "pro plan" with included usage
- Provider partnerships / Stripe Connect for premium providers
- Tier-based service bundling (Notion Plus etc.)
- The 9 hard-RED services
- Web dashboard for the registry user account (config CLI is enough)

These are deferred to v2+ once v1 has real users and real signal.
