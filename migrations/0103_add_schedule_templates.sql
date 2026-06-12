CREATE TABLE IF NOT EXISTS schedule_templates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  occupancy_tier text NOT NULL DEFAULT 'custom',
  description text,
  source_schedule_id varchar REFERENCES weekly_schedules(id) ON DELETE SET NULL,
  created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_templates_name
  ON schedule_templates(name);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_tier
  ON schedule_templates(occupancy_tier);

CREATE INDEX IF NOT EXISTS idx_schedule_templates_active
  ON schedule_templates(active);

CREATE TABLE IF NOT EXISTS schedule_template_shifts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id varchar NOT NULL REFERENCES schedule_templates(id) ON DELETE CASCADE,
  day_offset integer NOT NULL CHECK (day_offset BETWEEN 0 AND 6),
  employee_id varchar REFERENCES schedule_employees(id) ON DELETE SET NULL,
  employee_name text,
  shift_type_id varchar REFERENCES schedule_shift_types(id) ON DELETE SET NULL,
  shift_type_label text,
  custom_start_time time,
  custom_end_time time,
  unpaid_break_minutes integer,
  role_worked text,
  role_note text,
  manager_note text,
  is_open_shift boolean NOT NULL DEFAULT false,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_template_shifts_template
  ON schedule_template_shifts(template_id);

CREATE INDEX IF NOT EXISTS idx_schedule_template_shifts_employee
  ON schedule_template_shifts(employee_id);
