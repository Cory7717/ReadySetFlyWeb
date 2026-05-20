CREATE TABLE IF NOT EXISTS schedule_housekeeping_boards (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id varchar NOT NULL REFERENCES weekly_schedules(id) ON DELETE CASCADE,
  employee_id varchar NOT NULL REFERENCES schedule_employees(id) ON DELETE CASCADE,
  board_date date NOT NULL,
  actual_hours numeric(5,2) NOT NULL DEFAULT '0',
  checkout_rooms integer NOT NULL DEFAULT 0,
  stayover_rooms integer NOT NULL DEFAULT 0,
  dnd_rooms integer NOT NULL DEFAULT 0,
  ooo_rooms integer NOT NULL DEFAULT 0,
  deep_clean_rooms integer NOT NULL DEFAULT 0,
  notes text,
  entered_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_schedule_hk_board_unique
  ON schedule_housekeeping_boards(schedule_id, employee_id, board_date);

CREATE INDEX IF NOT EXISTS idx_schedule_hk_board_schedule_date
  ON schedule_housekeeping_boards(schedule_id, board_date);

CREATE INDEX IF NOT EXISTS idx_schedule_hk_board_employee
  ON schedule_housekeeping_boards(employee_id);
