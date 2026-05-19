CREATE TABLE IF NOT EXISTS schedule_requests (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id varchar NOT NULL REFERENCES tips_users(id) ON DELETE CASCADE,
  department text NOT NULL DEFAULT 'Front Desk',
  request_date date NOT NULL,
  request_type text NOT NULL DEFAULT 'time_off',
  start_time time,
  end_time time,
  notes text,
  status text NOT NULL DEFAULT 'submitted',
  reviewed_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  reviewed_at timestamp,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_schedule_requests_requester ON schedule_requests (requester_user_id);
CREATE INDEX IF NOT EXISTS idx_schedule_requests_department ON schedule_requests (department);
CREATE INDEX IF NOT EXISTS idx_schedule_requests_date ON schedule_requests (request_date);
CREATE INDEX IF NOT EXISTS idx_schedule_requests_status ON schedule_requests (status);
