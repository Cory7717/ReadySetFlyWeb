CREATE TABLE IF NOT EXISTS courtyard_budget_uploads (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  month integer NOT NULL,
  year integer NOT NULL,
  original_file_name text NOT NULL,
  uploaded_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  uploaded_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courtyard_budget_upload_period
  ON courtyard_budget_uploads(property_id, year, month);

CREATE TABLE IF NOT EXISTS courtyard_budget_line_items (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  budget_upload_id varchar NOT NULL REFERENCES courtyard_budget_uploads(id) ON DELETE CASCADE,
  property_id text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  month integer NOT NULL,
  year integer NOT NULL,
  department text NOT NULL,
  source_sheet text,
  line_item text NOT NULL,
  coa text,
  category_type text NOT NULL DEFAULT 'controllable',
  visibility_level text NOT NULL DEFAULT 'department',
  actual_amount numeric(12,2) NOT NULL DEFAULT 0,
  actual_percent numeric(9,4) NOT NULL DEFAULT 0,
  original_budget_amount numeric(12,2) NOT NULL DEFAULT 0,
  original_budget_percent numeric(9,4) NOT NULL DEFAULT 0,
  updated_forecast_amount numeric(12,2) NOT NULL DEFAULT 0,
  prior_year_amount numeric(12,2) NOT NULL DEFAULT 0,
  prior_year_percent numeric(9,4) NOT NULL DEFAULT 0,
  ytd_actual_amount numeric(12,2) NOT NULL DEFAULT 0,
  ytd_actual_percent numeric(9,4) NOT NULL DEFAULT 0,
  ytd_budget_amount numeric(12,2) NOT NULL DEFAULT 0,
  ytd_budget_percent numeric(9,4) NOT NULL DEFAULT 0,
  is_sensitive boolean NOT NULL DEFAULT false,
  is_hidden_from_department_head boolean NOT NULL DEFAULT false,
  is_total boolean NOT NULL DEFAULT false,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courtyard_budget_lines_period
  ON courtyard_budget_line_items(property_id, year, month);

CREATE INDEX IF NOT EXISTS idx_courtyard_budget_lines_department
  ON courtyard_budget_line_items(department);

CREATE TABLE IF NOT EXISTS courtyard_budget_checkbook_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  department text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  entry_date date NOT NULL,
  vendor text NOT NULL,
  category text NOT NULL,
  description text,
  amount numeric(12,2) NOT NULL DEFAULT 0,
  receipt_path text,
  entered_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courtyard_budget_checkbook_period
  ON courtyard_budget_checkbook_entries(property_id, year, month);

CREATE INDEX IF NOT EXISTS idx_courtyard_budget_checkbook_department
  ON courtyard_budget_checkbook_entries(department);

CREATE TABLE IF NOT EXISTS courtyard_budget_audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  department text,
  month integer,
  year integer,
  metadata_json jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courtyard_budget_audit_period
  ON courtyard_budget_audit_log(year, month);

CREATE INDEX IF NOT EXISTS idx_courtyard_budget_audit_created
  ON courtyard_budget_audit_log(created_at);
