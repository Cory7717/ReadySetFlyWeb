ALTER TABLE "schedule_forecast_days"
  ADD COLUMN IF NOT EXISTS "otb_room_revenue" numeric(12, 2);

UPDATE "schedule_forecast_days"
SET "otb_room_revenue" = "room_revenue"
WHERE "otb_room_revenue" IS NULL
  AND "otb_rooms_sold" IS NOT NULL;
