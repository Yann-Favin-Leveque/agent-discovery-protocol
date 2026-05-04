-- ============================================================================
-- Migration 005: add services.setup_guide JSONB column
-- Date: 2026-05-04
--
-- Adds the setup_guide column referenced by insertService / replaceServiceCapabilities
-- in src/lib/db.ts. The column was added to production at some point during
-- the user-owned-credentials work but the corresponding migration was never
-- committed to the repo, so a fresh database (Neon, in this case) lacked it
-- and admin imports failed with "Internal server error during capability
-- replacement".
--
-- Idempotent: uses ADD COLUMN IF NOT EXISTS.
-- ============================================================================

ALTER TABLE services ADD COLUMN IF NOT EXISTS setup_guide JSONB;
