CREATE TABLE IF NOT EXISTS tip_daily_report_attachments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  storage_path text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  uploaded_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  uploaded_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_daily_report_date ON tip_daily_report_attachments (report_date);
CREATE INDEX IF NOT EXISTS idx_tip_daily_report_period ON tip_daily_report_attachments (pay_period_start, pay_period_end);

CREATE TABLE IF NOT EXISTS tip_grid_submissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  week1_total numeric(10, 2) NOT NULL DEFAULT 0,
  week2_total numeric(10, 2) NOT NULL DEFAULT 0,
  total_tips numeric(10, 2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'submitted',
  submitted_at timestamp DEFAULT now(),
  reviewed_at timestamp,
  reviewed_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  pdf_path text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_grid_submissions_period ON tip_grid_submissions (pay_period_start, pay_period_end);

CREATE TABLE IF NOT EXISTS tips_kiosk_settings (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  updated_at timestamp DEFAULT now()
);
