ALTER TABLE "courtyard_meeting_events"
  ADD COLUMN IF NOT EXISTS "snack_bar_per_person" numeric(10, 2);
