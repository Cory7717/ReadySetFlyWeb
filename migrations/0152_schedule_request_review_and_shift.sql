ALTER TABLE schedule_requests
  ADD COLUMN IF NOT EXISTS requested_shift_type_id varchar REFERENCES schedule_shift_types(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS requested_shift_label text;

-- Conflicts are manager-facing coverage warnings, not a separate request state.
-- Keep the earliest identical waitlist request and close repeated copies.
WITH ranked_waitlist AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY requester_user_id, department, request_date,
        COALESCE(request_end_date, request_date), request_type,
        COALESCE(start_time::text, ''), COALESCE(end_time::text, '')
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS duplicate_rank
  FROM schedule_requests
  WHERE status = 'waitlisted'
)
UPDATE schedule_requests AS request
SET status = 'cancelled', updated_at = now()
FROM ranked_waitlist AS ranked
WHERE request.id = ranked.id
  AND ranked.duplicate_rank > 1;

UPDATE schedule_requests
SET status = 'submitted', updated_at = now()
WHERE status = 'waitlisted';
