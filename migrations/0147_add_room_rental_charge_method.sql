ALTER TABLE "courtyard_meeting_events"
  ADD COLUMN IF NOT EXISTS "room_rental_charge_method" text NOT NULL DEFAULT 'per_event';

ALTER TABLE "courtyard_meeting_events"
  DROP CONSTRAINT IF EXISTS "courtyard_meeting_events_room_rental_charge_method_check";

ALTER TABLE "courtyard_meeting_events"
  ADD CONSTRAINT "courtyard_meeting_events_room_rental_charge_method_check"
  CHECK ("room_rental_charge_method" IN ('per_event', 'per_day'));
