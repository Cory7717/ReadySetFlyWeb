ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "logbook_pro_status" text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "logbook_pro_plan" text,
  ADD COLUMN IF NOT EXISTS "logbook_pro_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "logbook_pro_started_at" timestamp,
  ADD COLUMN IF NOT EXISTS "logbook_pro_ends_at" timestamp,
  ADD COLUMN IF NOT EXISTS "logbook_pro_canceled_at" timestamp,
  ADD COLUMN IF NOT EXISTS "logbook_pro_cancel_at_period_end" boolean DEFAULT false;
