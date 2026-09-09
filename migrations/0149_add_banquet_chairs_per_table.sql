ALTER TABLE "courtyard_meeting_events"
  ADD COLUMN IF NOT EXISTS "banquet_chairs_per_table" integer NOT NULL DEFAULT 8;

ALTER TABLE "courtyard_meeting_events"
  DROP CONSTRAINT IF EXISTS "courtyard_meeting_events_banquet_chairs_per_table_check";

ALTER TABLE "courtyard_meeting_events"
  ADD CONSTRAINT "courtyard_meeting_events_banquet_chairs_per_table_check"
  CHECK ("banquet_chairs_per_table" BETWEEN 1 AND 8);
