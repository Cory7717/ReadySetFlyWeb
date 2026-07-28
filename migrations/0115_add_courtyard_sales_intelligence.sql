CREATE TABLE IF NOT EXISTS courtyard_sales_import_batches (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  report_year integer NOT NULL, report_month integer NOT NULL, original_filename text NOT NULL, detected_delimiter text NOT NULL,
  source_report_type text NOT NULL DEFAULT 'marriott_mint_analytical_account_tracking', uploaded_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  row_count integer NOT NULL DEFAULT 0, accepted_row_count integer NOT NULL DEFAULT 0, rejected_row_count integer NOT NULL DEFAULT 0,
  duplicate_row_count integer NOT NULL DEFAULT 0, file_checksum text NOT NULL, status text NOT NULL DEFAULT 'completed',
  validation_summary_json jsonb NOT NULL DEFAULT '{}'::jsonb, replaced_at timestamp, created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_import_period ON courtyard_sales_import_batches(hotel_id, report_year, report_month);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_import_checksum ON courtyard_sales_import_batches(hotel_id, file_checksum);

CREATE TABLE IF NOT EXISTS courtyard_sales_raw_rows (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), import_batch_id varchar NOT NULL REFERENCES courtyard_sales_import_batches(id) ON DELETE CASCADE,
  source_row_number integer NOT NULL, raw_payload_json jsonb NOT NULL, normalized_row_hash text NOT NULL, created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_raw_batch ON courtyard_sales_raw_rows(import_batch_id);

CREATE TABLE IF NOT EXISTS courtyard_sales_production (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), import_batch_id varchar NOT NULL REFERENCES courtyard_sales_import_batches(id) ON DELETE CASCADE,
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE, report_year integer NOT NULL, report_month integer NOT NULL,
  global_ultimate_account_name text, highest_level_account_id text, account_name text, account_id text, account_type text,
  market_category text, market_segment text, rate_program_code text, rate_program text, booking_office text,
  room_nights numeric(14,3) NOT NULL DEFAULT 0, room_revenue numeric(16,2) NOT NULL DEFAULT 0, room_adr numeric(14,2),
  total_revenue numeric(16,2), total_adr numeric(14,2), average_los numeric(12,3), fees numeric(16,2), taxes numeric(16,2), add_ons numeric(16,2),
  source_row_number integer NOT NULL, normalized_account_key text NOT NULL, normalized_row_hash text NOT NULL, created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_production_period ON courtyard_sales_production(hotel_id, report_year, report_month);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_production_account ON courtyard_sales_production(hotel_id, normalized_account_key);
