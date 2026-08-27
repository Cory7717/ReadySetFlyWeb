-- Separate migration supports environments where an earlier revenue migration already ran.
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "tax_percent" numeric(6,3);
