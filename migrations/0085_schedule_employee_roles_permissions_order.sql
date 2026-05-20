ALTER TABLE schedule_employees
  ADD COLUMN IF NOT EXISTS roles_json jsonb,
  ADD COLUMN IF NOT EXISTS is_salaried boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_department_manager boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sort_order integer NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_schedule_employees_sort
  ON schedule_employees(department, sort_order);

ALTER TABLE schedule_shift_assignments
  ADD COLUMN IF NOT EXISTS role_worked text;

ALTER TABLE weekly_schedules
  ADD COLUMN IF NOT EXISTS department_status_json jsonb;
