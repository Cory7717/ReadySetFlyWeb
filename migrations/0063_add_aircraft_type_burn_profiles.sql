ALTER TABLE aircraft_types
  ADD COLUMN IF NOT EXISTS fuel_burn_economy_gph numeric(6, 2),
  ADD COLUMN IF NOT EXISTS fuel_burn_performance_gph numeric(6, 2);

UPDATE aircraft_types
SET
  fuel_burn_gph = 16.50,
  fuel_burn_economy_gph = 14.00,
  fuel_burn_performance_gph = 18.00,
  source_note = 'Baseline burn set to 16.5 GPH with economy/performance planning profiles added for lean-of-peak versus higher-power cruise planning.',
  updated_at = NOW()
WHERE
  lower(make) = 'cirrus'
  AND (
    lower(model) = 'sr22t'
    OR lower(model) = 'sr22 t'
    OR lower(model) LIKE 'sr22t%'
    OR lower(model) LIKE 'sr22 t%'
    OR lower(COALESCE(icao_type, '')) = 'sr22'
  );
