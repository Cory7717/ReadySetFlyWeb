CREATE TABLE IF NOT EXISTS tip_banquet_reports (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date date NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  event_name text NOT NULL,
  gross_sales numeric(10, 2) NOT NULL DEFAULT 0,
  banquet_tips numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  storage_path text,
  original_file_name text,
  mime_type text,
  size integer,
  updated_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tip_banquet_reports_date
  ON tip_banquet_reports(event_date);

CREATE INDEX IF NOT EXISTS idx_tip_banquet_reports_period
  ON tip_banquet_reports(pay_period_start, pay_period_end);
