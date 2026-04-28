-- Migration 0071: add user-level marketing email opt-out support

BEGIN;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "marketing_email_opt_out_at" timestamp;

COMMIT;
