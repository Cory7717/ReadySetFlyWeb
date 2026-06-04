CREATE TABLE IF NOT EXISTS schedule_actual_hours (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  employee_id varchar NOT NULL REFERENCES schedule_employees(id) ON DELETE CASCADE,
  work_date date NOT NULL,
  actual_hours numeric(5,2) NOT NULL DEFAULT 0,
  notes text,
  source text NOT NULL DEFAULT 'manual',
  entered_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_actual_hours_unique
  ON schedule_actual_hours (schedule_id, employee_id, work_date);

CREATE INDEX IF NOT EXISTS idx_schedule_actual_hours_schedule_date
  ON schedule_actual_hours (schedule_id, work_date);

CREATE INDEX IF NOT EXISTS idx_schedule_actual_hours_employee
  ON schedule_actual_hours (employee_id);
