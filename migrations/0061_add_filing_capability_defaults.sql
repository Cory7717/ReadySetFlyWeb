ALTER TABLE flight_plans
  ADD COLUMN IF NOT EXISTS filing_wake_turbulence text,
  ADD COLUMN IF NOT EXISTS filing_type_of_flight text,
  ADD COLUMN IF NOT EXISTS filing_surveillance_equipment text,
  ADD COLUMN IF NOT EXISTS filing_other_info text;

ALTER TABLE aircraft_profiles
  ADD COLUMN IF NOT EXISTS filing_wake_turbulence_default text,
  ADD COLUMN IF NOT EXISTS filing_type_of_flight_default text,
  ADD COLUMN IF NOT EXISTS filing_surveillance_equipment_default text,
  ADD COLUMN IF NOT EXISTS filing_other_info_default text;
