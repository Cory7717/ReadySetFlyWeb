ALTER TABLE aircraft_types
  ADD COLUMN IF NOT EXISTS verification_source text,
  ADD COLUMN IF NOT EXISTS verification_url text,
  ADD COLUMN IF NOT EXISTS last_verified_at timestamp;

UPDATE aircraft_types
SET
  fuel_burn_gph = 9.50,
  is_verified = true,
  source_note = 'Adjusted to a 9.5 GPH typical cruise planning burn for the Diamond DA42. Verify exact burn against the POH/AFM, power setting, and installed engine variant.',
  verification_source = 'Diamond DA42 POH / manufacturer planning guidance',
  last_verified_at = NOW(),
  updated_at = NOW()
WHERE
  lower(make) = 'diamond'
  AND (
    lower(model) = 'da42'
    OR lower(model) = 'da-42'
    OR lower(model) = 'da 42'
    OR lower(model) LIKE 'da42%'
    OR lower(model) LIKE 'da-42%'
    OR lower(model) LIKE 'da 42%'
    OR lower(COALESCE(icao_type, '')) = 'da42'
  );
