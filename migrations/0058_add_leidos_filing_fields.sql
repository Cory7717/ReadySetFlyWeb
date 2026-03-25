ALTER TABLE "flight_plans"
  ADD COLUMN IF NOT EXISTS "filing_equipment" text,
  ADD COLUMN IF NOT EXISTS "filing_souls_on_board" text,
  ADD COLUMN IF NOT EXISTS "filing_aircraft_color" text,
  ADD COLUMN IF NOT EXISTS "filing_pilot_name" text,
  ADD COLUMN IF NOT EXISTS "filing_remarks" text,
  ADD COLUMN IF NOT EXISTS "filing_estimated_enroute_minutes" integer,
  ADD COLUMN IF NOT EXISTS "filing_endurance_minutes" integer;
