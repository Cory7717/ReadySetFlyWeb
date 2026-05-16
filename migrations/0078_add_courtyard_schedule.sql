CREATE TABLE IF NOT EXISTS schedule_employees (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  first_name text NOT NULL,
  last_name text NOT NULL,
  display_name text NOT NULL,
  department text NOT NULL DEFAULT 'Other',
  position text,
  default_shift_type text,
  max_weekly_hours numeric(6, 2),
  phone text,
  email varchar,
  active boolean NOT NULL DEFAULT true,
  availability_json jsonb,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_employees_department ON schedule_employees (department);
CREATE INDEX IF NOT EXISTS idx_schedule_employees_active ON schedule_employees (active);

CREATE TABLE IF NOT EXISTS schedule_shift_types (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  label text NOT NULL UNIQUE,
  start_time time,
  end_time time,
  unpaid_break_minutes integer NOT NULL DEFAULT 0,
  color text NOT NULL,
  text_color text NOT NULL DEFAULT '#111827',
  department_hint text,
  is_overnight boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_shift_types_active ON schedule_shift_types (active);
CREATE INDEX IF NOT EXISTS idx_schedule_shift_types_sort ON schedule_shift_types (sort_order);

CREATE TABLE IF NOT EXISTS weekly_schedules (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  property_name text NOT NULL DEFAULT 'Courtyard Austin Lakeline',
  week_start_date date NOT NULL,
  week_end_date date NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  published_at timestamp,
  archived_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_schedules_week ON weekly_schedules (week_start_date);
CREATE INDEX IF NOT EXISTS idx_weekly_schedules_status ON weekly_schedules (status);

CREATE TABLE IF NOT EXISTS schedule_forecast_days (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  forecast_date date NOT NULL,
  rooms_sold integer NOT NULL DEFAULT 0,
  occupancy_percent numeric(5, 2) NOT NULL DEFAULT 0,
  arrivals integer NOT NULL DEFAULT 0,
  departures integer NOT NULL DEFAULT 0,
  stayovers integer NOT NULL DEFAULT 0,
  groups_events_notes text,
  notes text,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_forecast_schedule_date ON schedule_forecast_days (schedule_id, forecast_date);

CREATE TABLE IF NOT EXISTS schedule_shift_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  employee_id varchar REFERENCES schedule_employees(id) ON DELETE SET NULL,
  shift_date date NOT NULL,
  shift_type_id varchar REFERENCES schedule_shift_types(id) ON DELETE SET NULL,
  custom_start_time time,
  custom_end_time time,
  unpaid_break_minutes integer,
  role_note text,
  manager_note text,
  is_open_shift boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_shift_unique ON schedule_shift_assignments (schedule_id, employee_id, shift_date);
CREATE INDEX IF NOT EXISTS idx_schedule_shift_schedule_date ON schedule_shift_assignments (schedule_id, shift_date);

CREATE TABLE IF NOT EXISTS schedule_share_links (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE,
  created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  revoked_at timestamp
);

CREATE INDEX IF NOT EXISTS idx_schedule_share_links_schedule ON schedule_share_links (schedule_id);

CREATE TABLE IF NOT EXISTS schedule_audit_log (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  actor_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  action text NOT NULL,
  metadata_json jsonb,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_audit_schedule ON schedule_audit_log (schedule_id);
CREATE INDEX IF NOT EXISTS idx_schedule_audit_created ON schedule_audit_log (created_at);
