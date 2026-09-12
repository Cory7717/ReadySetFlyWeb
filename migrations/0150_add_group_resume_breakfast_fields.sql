ALTER TABLE "courtyard_group_room_blocks"
  ADD COLUMN IF NOT EXISTS "breakfast_service" text NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS "breakfast_guaranteed_count" integer,
  ADD COLUMN IF NOT EXISTS "breakfast_price_per_person" numeric(10, 2),
  ADD COLUMN IF NOT EXISTS "breakfast_service_dates" text,
  ADD COLUMN IF NOT EXISTS "breakfast_service_time" text,
  ADD COLUMN IF NOT EXISTS "breakfast_location" text;

ALTER TABLE "courtyard_group_room_blocks"
  DROP CONSTRAINT IF EXISTS "courtyard_group_room_blocks_breakfast_service_check";

ALTER TABLE "courtyard_group_room_blocks"
  ADD CONSTRAINT "courtyard_group_room_blocks_breakfast_service_check"
  CHECK ("breakfast_service" IN ('none', 'included', 'contracted_buffet'));
