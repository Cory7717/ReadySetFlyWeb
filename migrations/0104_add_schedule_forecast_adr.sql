ALTER TABLE "schedule_forecast_days"
ADD COLUMN IF NOT EXISTS "forecast_adr" numeric(10, 2);

UPDATE "schedule_forecast_days"
SET "forecast_adr" = ROUND(
  "room_revenue" / NULLIF("rooms_sold" + COALESCE("popup_group_rooms", 0), 0),
  2
)
WHERE "forecast_adr" IS NULL
  AND COALESCE("room_revenue", 0) > 0
  AND ("rooms_sold" + COALESCE("popup_group_rooms", 0)) > 0;
