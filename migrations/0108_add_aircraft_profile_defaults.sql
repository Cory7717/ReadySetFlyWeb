ALTER TABLE aircraft_profiles
  ADD COLUMN IF NOT EXISTS is_default boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS custom_manufacturer text,
  ADD COLUMN IF NOT EXISTS custom_model text,
  ADD COLUMN IF NOT EXISTS custom_icao_type text,
  ADD COLUMN IF NOT EXISTS engine_type_override text,
  ADD COLUMN IF NOT EXISTS engine_count_override integer,
  ADD COLUMN IF NOT EXISTS fuel_burn_default_gph numeric(6, 2),
  ADD COLUMN IF NOT EXISTS notes text,
  ADD COLUMN IF NOT EXISTS filing_emergency_equipment_default text,
  ADD COLUMN IF NOT EXISTS filing_transponder_default text,
  ADD COLUMN IF NOT EXISTS filing_performance_category_default text,
  ADD COLUMN IF NOT EXISTS filing_elt_default text,
  ADD COLUMN IF NOT EXISTS filing_flight_rules_default text,
  ADD COLUMN IF NOT EXISTS filing_cruising_speed_default text,
  ADD COLUMN IF NOT EXISTS filing_altitude_preference_default text,
  ADD COLUMN IF NOT EXISTS filing_endurance_minutes_default integer;

CREATE INDEX IF NOT EXISTS idx_aircraft_profiles_user_default
  ON aircraft_profiles (user_id, is_default);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_aircraft_profiles_one_default_per_user
  ON aircraft_profiles (user_id)
  WHERE is_default = true;
