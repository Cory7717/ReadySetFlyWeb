ALTER TABLE "flight_plans"
  ADD COLUMN IF NOT EXISTS "filing_true_airspeed_ktas" integer,
  ADD COLUMN IF NOT EXISTS "filing_planned_altitude_ft" integer;
