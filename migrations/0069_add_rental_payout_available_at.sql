-- Migration 0069: Add payout_available_at to rentals for hold-period support
--
-- Deployment target: ep-weathered-leaf-ahqeessy-pooler... (Render / Neon)
--
-- Apply with:
--   psql "$DATABASE_URL" -f migrations/0069_add_rental_payout_available_at.sql
-- Or via Neon console SQL editor.
--
-- Safe to re-run (IF NOT EXISTS guard).

BEGIN;

-- rentals.payout_available_at
-- NULL means no hold was set (old records) — treated as immediately available.
-- Non-null means earnings are on hold until this timestamp.
ALTER TABLE "rentals"
  ADD COLUMN IF NOT EXISTS "payout_available_at" timestamp;

COMMIT;
