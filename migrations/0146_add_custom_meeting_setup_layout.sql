ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "setup_orientation" text NOT NULL DEFAULT 'lengthwise';
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "setup_layout_json" jsonb NOT NULL DEFAULT '[]'::jsonb;
