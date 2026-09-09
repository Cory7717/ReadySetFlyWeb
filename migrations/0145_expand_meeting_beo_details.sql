ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "service_items_json" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "gratuity_allocations_json" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "billing_instructions" text;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "setup_notes" text;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "decor_notes" text;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "damage_notes" text;
