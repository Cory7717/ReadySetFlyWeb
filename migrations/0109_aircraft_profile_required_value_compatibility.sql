ALTER TABLE aircraft_profiles
  ADD COLUMN IF NOT EXISTS aircraft_type text,
  ADD COLUMN IF NOT EXISTS cruise_ktas numeric(6, 2),
  ADD COLUMN IF NOT EXISTS fuel_burn_gph numeric(6, 2),
  ADD COLUMN IF NOT EXISTS max_range_nm numeric(8, 2),
  ADD COLUMN IF NOT EXISTS service_ceiling_ft integer,
  ADD COLUMN IF NOT EXISTS wake_category text,
  ADD COLUMN IF NOT EXISTS equipment_codes text,
  ADD COLUMN IF NOT EXISTS surveillance_codes text;

UPDATE aircraft_profiles
SET
  cruise_ktas = COALESCE(cruise_ktas, cruise_ktas_override),
  fuel_burn_gph = COALESCE(fuel_burn_gph, fuel_burn_override_gph, fuel_burn_default_gph),
  aircraft_type = COALESCE(aircraft_type, custom_icao_type),
  wake_category = COALESCE(wake_category, filing_wake_turbulence_default),
  equipment_codes = COALESCE(equipment_codes, filing_equipment_default),
  surveillance_codes = COALESCE(surveillance_codes, filing_surveillance_equipment_default)
WHERE
  cruise_ktas IS NULL
  OR fuel_burn_gph IS NULL
  OR aircraft_type IS NULL
  OR wake_category IS NULL
  OR equipment_codes IS NULL
  OR surveillance_codes IS NULL;
