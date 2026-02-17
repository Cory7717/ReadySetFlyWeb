ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "weekly_email_opt_in" boolean DEFAULT true NOT NULL,
  ADD COLUMN IF NOT EXISTS "weekly_email_last_sent_at" timestamp,
  ADD COLUMN IF NOT EXISTS "weekly_email_opt_out_at" timestamp;
