-- Migration: Drop Stripe Connect / marketplace tables
-- Date: 2026-04-28
-- Spec: docs/pivot-unified-billing.md (section 4 "Architecture / Schema changes")
--
-- Final cleanup step of the v1 unified-billing pivot. The application code
-- that referenced these tables was removed in commits E1 and E2:
--   - E1: deleted /api/subscriptions/*, /api/providers/connect/*,
--          /providers/connect, /pay/setup, /account/billing pages.
--   - E2: removed lib/stripe.ts Connect/subscription helpers and the
--          provider/subscription/transaction query functions in lib/db.ts;
--          gutted the subscription/account-update handlers in
--          api/webhooks/stripe.
-- With no app code touching these tables, it is now safe to drop them.
--
-- Why these tables go away in the single-tenant aggregator model:
--   - provider_accounts  — Stripe Connect provider onboarding is irrelevant;
--                          we (AgentDNS) are the only merchant.
--   - subscriptions      — replaced by user_service_enablement toggles +
--                          (in v1.5) per-call billing through usage_events.
--   - transactions       — per-payment-intent history is duplicated by
--                          Stripe-side records; we'll surface them via the
--                          Stripe Customer Portal instead. Future per-call
--                          metering uses usage_events (deferred to v1.5,
--                          see migration 003).
--
-- IRREVERSIBLE: this migration drops data. Make sure you have a backup
-- (registry has been doing nightly pg_dumps; the .claude/tmp directory in
-- the repo also has a 2026-03-07 dump). There is no down-migration; if
-- the marketplace model needs to come back, the schema and code can be
-- restored from git history (commits 4c15829 and 5a030d8 plus their
-- parents). CASCADE is used so dependent foreign keys (none expected,
-- but kept defensive) don't block the drops.

DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS transactions CASCADE;
DROP TABLE IF EXISTS provider_accounts CASCADE;

-- Dropped: subscriptions, transactions, provider_accounts. This migration
-- is irreversible — the data and schema are gone. Re-introducing the
-- marketplace model would require a fresh schema design, not a revert.
