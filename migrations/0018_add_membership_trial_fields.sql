ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "membership_interval" text,
  ADD COLUMN IF NOT EXISTS "membership_trial_ends_at" timestamp,
  ADD COLUMN IF NOT EXISTS "membership_next_billing_at" timestamp;
