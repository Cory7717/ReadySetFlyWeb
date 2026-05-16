CREATE TABLE IF NOT EXISTS tips_users (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  email varchar NOT NULL UNIQUE,
  employee_display_name text NOT NULL,
  position text,
  role text NOT NULL DEFAULT 'employee',
  hashed_password text NOT NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tips_users_email ON tips_users (email);

CREATE TABLE IF NOT EXISTS tip_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES tips_users(id) ON DELETE CASCADE,
  entry_date date NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  tip_amount numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  status text NOT NULL DEFAULT 'saved',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_entries_user_date ON tip_entries (user_id, entry_date);
CREATE INDEX IF NOT EXISTS idx_tip_entries_user_period ON tip_entries (user_id, pay_period_start, pay_period_end);

CREATE TABLE IF NOT EXISTS tip_entry_attachments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  tip_entry_id varchar NOT NULL REFERENCES tip_entries(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  original_file_name text NOT NULL,
  mime_type text NOT NULL,
  size integer NOT NULL,
  uploaded_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tip_entry_attachments_entry ON tip_entry_attachments (tip_entry_id);

CREATE TABLE IF NOT EXISTS tip_period_submissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar NOT NULL REFERENCES tips_users(id) ON DELETE CASCADE,
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_submissions_user_period ON tip_period_submissions (user_id, pay_period_start, pay_period_end);
CREATE INDEX IF NOT EXISTS idx_tip_submissions_period ON tip_period_submissions (pay_period_start, pay_period_end);

CREATE TABLE IF NOT EXISTS tip_admin_actions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  target_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata_json jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tip_admin_actions_target ON tip_admin_actions (target_user_id);
CREATE INDEX IF NOT EXISTS idx_tip_admin_actions_created ON tip_admin_actions (created_at);
