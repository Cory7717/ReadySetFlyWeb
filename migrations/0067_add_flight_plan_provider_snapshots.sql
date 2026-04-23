ALTER TABLE "flight_plans"
  ADD COLUMN IF NOT EXISTS "filing_payload" jsonb,
  ADD COLUMN IF NOT EXISTS "filing_provider_snapshot" jsonb,
  ADD COLUMN IF NOT EXISTS "filing_provider_messages" jsonb DEFAULT '[]'::jsonb;

ALTER TABLE "user_settings"
  ADD COLUMN IF NOT EXISTS "flight_service_profile" jsonb;
