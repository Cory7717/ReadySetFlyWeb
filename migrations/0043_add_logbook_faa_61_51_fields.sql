ALTER TABLE logbook_entries
  ADD COLUMN IF NOT EXISTS aircraft_category text,
  ADD COLUMN IF NOT EXISTS aircraft_class text,
  ADD COLUMN IF NOT EXISTS is_simulator boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS device_type text,
  ADD COLUMN IF NOT EXISTS solo numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cross_country numeric(6,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cfi_cert_number text,
  ADD COLUMN IF NOT EXISTS cfi_cert_expires date;
