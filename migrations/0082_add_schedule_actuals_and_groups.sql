ALTER TABLE schedule_forecast_days
  ADD COLUMN IF NOT EXISTS otb_rooms_sold integer,
  ADD COLUMN IF NOT EXISTS otb_occupancy_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS otb_arrivals integer,
  ADD COLUMN IF NOT EXISTS otb_departures integer,
  ADD COLUMN IF NOT EXISTS actual_rooms_sold integer,
  ADD COLUMN IF NOT EXISTS actual_occupancy_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS actual_arrivals integer,
  ADD COLUMN IF NOT EXISTS actual_departures integer,
  ADD COLUMN IF NOT EXISTS popup_group_rooms integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS popup_group_notes text;
