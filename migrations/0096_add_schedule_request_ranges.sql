ALTER TABLE schedule_requests
  ADD COLUMN IF NOT EXISTS request_end_date date,
  ADD COLUMN IF NOT EXISTS request_group_id varchar;

UPDATE schedule_requests
SET request_end_date = request_date
WHERE request_end_date IS NULL;

CREATE INDEX IF NOT EXISTS idx_schedule_requests_end_date ON schedule_requests (request_end_date);
CREATE INDEX IF NOT EXISTS idx_schedule_requests_group ON schedule_requests (request_group_id);
