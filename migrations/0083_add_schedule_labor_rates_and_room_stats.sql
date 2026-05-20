ALTER TABLE schedule_employees
  ADD COLUMN IF NOT EXISTS hourly_rate numeric(10,2);

ALTER TABLE schedule_forecast_days
  ADD COLUMN IF NOT EXISTS dnd_rooms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS room_revenue numeric(12,2),
  ADD COLUMN IF NOT EXISTS actual_room_revenue numeric(12,2);
