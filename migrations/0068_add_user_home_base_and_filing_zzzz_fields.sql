-- Migration 0068: Add home_base to users and ZZZZ/overdue-close fields to flight_plans
--
-- Deployment target: ep-weathered-leaf-ahqeessy-pooler... (Render / Neon)
--
-- Apply with:
--   psql "$DATABASE_URL" -f migrations/0068_add_user_home_base_and_filing_zzzz_fields.sql
-- Or via Neon console SQL editor (paste contents, run).
--
-- All statements use ADD COLUMN IF NOT EXISTS — safe to re-run.

BEGIN;

-- users.home_base  (pilot home airport, e.g. "KMHV")
ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "home_base" text;

-- flight_plans: ICAO Item-18 supplemental location names for ZZZZ airports
ALTER TABLE "flight_plans"
  ADD COLUMN IF NOT EXISTS "filing_departure_name" text,
  ADD COLUMN IF NOT EXISTS "filing_destination_name" text,
  ADD COLUMN IF NOT EXISTS "filing_alternate_name" text;

-- flight_plans: actual close location for overdue VFR close (Leidos closeDestinationInfo)
ALTER TABLE "flight_plans"
  ADD COLUMN IF NOT EXISTS "filing_close_location" text;

COMMIT;
