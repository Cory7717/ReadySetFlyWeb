ALTER TABLE "hk_daily_metrics"
  ADD COLUMN IF NOT EXISTS "room_revenue_daily" numeric(12,2),
  ADD COLUMN IF NOT EXISTS "room_revenue_mtd" numeric(12,2);
