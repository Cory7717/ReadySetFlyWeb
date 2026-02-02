ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "membership_tier" text DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS "membership_status" text DEFAULT 'inactive',
  ADD COLUMN IF NOT EXISTS "membership_provider" text,
  ADD COLUMN IF NOT EXISTS "membership_ends_at" timestamp,
  ADD COLUMN IF NOT EXISTS "paypal_subscription_id" text,
  ADD COLUMN IF NOT EXISTS "paypal_plan_id" text;

UPDATE "users"
SET
  "membership_tier" = 'pro',
  "membership_status" = CASE
    WHEN "logbook_pro_status" = 'active' THEN 'active'
    WHEN "logbook_pro_status" IN ('cancelled', 'canceled', 'expired', 'suspended') THEN 'cancelled'
    WHEN "logbook_pro_status" IN ('payment_failed', 'past_due') THEN 'past_due'
    ELSE 'inactive'
  END,
  "membership_provider" = 'paypal',
  "membership_ends_at" = "logbook_pro_ends_at",
  "paypal_subscription_id" = "logbook_pro_subscription_id"
WHERE COALESCE("logbook_pro_status", 'free') <> 'free';
