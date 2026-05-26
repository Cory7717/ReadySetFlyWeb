ALTER TABLE tip_banquet_reports
  ADD COLUMN IF NOT EXISTS report_type text NOT NULL DEFAULT 'banquet_service',
  ADD COLUMN IF NOT EXISTS service_rate numeric(5, 4) NOT NULL DEFAULT 0.2100;
