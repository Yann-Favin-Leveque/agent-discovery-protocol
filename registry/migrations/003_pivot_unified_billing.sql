-- Migration: Pivot to unified billing (single-tenant aggregator model)
-- Date: 2026-04-28
-- Spec: docs/pivot-unified-billing.md (section 4 "Architecture / Schema changes")
--
-- This migration is the schema-only first step of the v1 unified-billing pivot.
-- It is intentionally minimal: it adds only what we need NOW to ship the
-- enabled-only `discover` behavior and the cold-start ranking.
--
-- What this migration ADDS:
--   1. user_service_enablement — per-user toggles + per-service spending caps
--      + optional BYO encrypted credential blob.
--   2. services.popularity_score — editorial 0..N score driving cold-start
--      ordering of `discover()` with no args.
--
-- What this migration deliberately DOES NOT do (see comment block at bottom):
--   - It does NOT create the per-call billing tables (service_credentials,
--     service_pricing, usage_events). Those are deferred to v1.5: we ship v1
--     without per-call billing and absorb provider costs manually until we
--     have traction signal worth investing the billing infra for.
--   - It does NOT drop provider_accounts or subscriptions. The Stripe Connect
--     and per-service subscription code in the app still references them.
--     Dropping them now would crash the running app. They will be removed
--     in a later migration once the dependent code is deleted.
--
-- Idempotency: every CREATE / ALTER uses IF NOT EXISTS so re-running this
-- migration is a no-op. No transaction wrapper — psql handles that for us,
-- matching the style of 001 and 002.

-- ─── 1. user_service_enablement ──────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_service_enablement (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  monthly_cap_cents INTEGER,                         -- NULL = no cap
  byo_credential_blob BYTEA,                         -- encrypted; NULL = use shared creds
  enabled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, service_id)
);

CREATE INDEX IF NOT EXISTS idx_user_service_enablement_user
  ON user_service_enablement(user_id);

CREATE INDEX IF NOT EXISTS idx_user_service_enablement_service
  ON user_service_enablement(service_id);

-- ─── 2. services.popularity_score ────────────────────────────────────────

ALTER TABLE services
  ADD COLUMN IF NOT EXISTS popularity_score INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_services_popularity_score
  ON services(popularity_score DESC);

-- ─── Deferred / deprecated (informational) ───────────────────────────────
--
-- Deferred to v1.5 (NOT created in this migration):
--   - service_credentials  — our encrypted credentials with each provider,
--                            unit + our_unit_cost_cents + free_quota_monthly.
--   - service_pricing      — what we charge users per service/capability/unit
--                            (markup or passthrough, with effective_from).
--   - usage_events         — per-call usage rows, source for monthly invoices.
--
-- Reason: v1 ships without per-call billing. We absorb provider costs
-- manually for the launch cohort and only build the metering pipeline once
-- usage justifies it. See docs/pivot-unified-billing.md and the team
-- discussion that defers these tables.
--
-- Deprecated, to be DROPPED in a later migration once dependent app code
-- is removed (see docs/pivot-unified-billing.md §4 "Drop"):
--   - provider_accounts    — Stripe Connect provider onboarding, irrelevant
--                            in single-tenant model.
--   - subscriptions        — per-user-per-service subscriptions, replaced by
--                            user_service_enablement toggles + pay-per-use.
--
-- These two tables (and the lib/stripe.ts Connect/subscription functions)
-- must be removed from the app first; only then can a follow-up migration
-- safely DROP TABLE them.
