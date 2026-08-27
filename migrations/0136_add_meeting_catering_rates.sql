-- Separate migration supports environments where the original revenue migration already ran.
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "breakfast_per_person" numeric(10,2);
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "lunch_dinner_per_person" numeric(10,2);
