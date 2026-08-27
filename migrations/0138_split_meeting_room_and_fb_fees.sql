ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "room_tax_percent" numeric(6,3) DEFAULT 6;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "room_service_fee_percent" numeric(6,3) DEFAULT 21;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "fb_tax_percent" numeric(6,3) DEFAULT 8.25;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "fb_gratuity_percent" numeric(6,3) DEFAULT 18;
