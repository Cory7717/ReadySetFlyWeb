-- Kept separate from 0134 so environments that already ran the first revenue
-- migration still receive the percentage-based fee fields.
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "service_fee_percent" numeric(6,3);
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "gratuity_percent" numeric(6,3);
