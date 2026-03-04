INSERT INTO aircraft_types (
  make,
  model,
  icao_type,
  category,
  engine_type,
  cruise_ktas,
  fuel_burn_gph,
  usable_fuel_gal,
  max_gross_weight_lb,
  default_altitude_ft,
  is_verified,
  source_note
)
SELECT
  'Van''s Aircraft',
  'RV-10',
  'RV10',
  'piston_single',
  'piston',
  170,
  14.5,
  60,
  2700,
  8500,
  false,
  'RSF baseline estimate for Van''s RV-10. Experimental/owner-configured aircraft vary; confirm with your POH and engine setup.'
WHERE NOT EXISTS (
  SELECT 1
  FROM aircraft_types
  WHERE upper(coalesce(icao_type, '')) = 'RV10'
     OR (lower(make) = 'van''s aircraft' AND lower(model) = 'rv-10')
);
