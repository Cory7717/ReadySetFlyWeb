-- Add IP and second signature columns to logbook_entries
ALTER TABLE "logbook_entries"
  ADD COLUMN IF NOT EXISTS "signature_ip" text,
  ADD COLUMN IF NOT EXISTS "cfi_signature_data_url" text,
  ADD COLUMN IF NOT EXISTS "cfi_signed_by_name" text,
  ADD COLUMN IF NOT EXISTS "cfi_signed_at" timestamp,
  ADD COLUMN IF NOT EXISTS "cfi_signature_ip" text;
