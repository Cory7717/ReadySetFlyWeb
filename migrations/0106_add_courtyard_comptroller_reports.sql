CREATE TABLE IF NOT EXISTS courtyard_comptroller_reports (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  report_month text NOT NULL,
  payload_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  uploaded_reports_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  settings_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courtyard_comptroller_report_period
  ON courtyard_comptroller_reports(property_id, report_month);

CREATE INDEX IF NOT EXISTS idx_courtyard_comptroller_report_updated
  ON courtyard_comptroller_reports(updated_at);
