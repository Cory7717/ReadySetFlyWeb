-- Remove legacy future requests that exceed the one-calendar-month submission policy.
-- Historical requests are retained for audit and reporting purposes.
DELETE FROM "schedule_requests"
WHERE "request_date" > (CURRENT_DATE + INTERVAL '1 month')::date
   OR COALESCE("request_end_date", "request_date") > (CURRENT_DATE + INTERVAL '1 month')::date;
