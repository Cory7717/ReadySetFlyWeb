ALTER TABLE flight_plans
  ADD COLUMN IF NOT EXISTS filing_pilot_phone text,
  ADD COLUMN IF NOT EXISTS filing_aircraft_home_base text,
  ADD COLUMN IF NOT EXISTS filing_assigned_beacon_code text;
