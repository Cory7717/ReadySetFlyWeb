CREATE TABLE IF NOT EXISTS "courtyard_group_bookings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE,
  "group_name" text NOT NULL, "project_name" text, "source_format" text, "import_profile" text,
  "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_courtyard_group_bookings_hotel" ON "courtyard_group_bookings"("hotel_id");
CREATE TABLE IF NOT EXISTS "courtyard_group_booking_documents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "group_booking_id" varchar NOT NULL REFERENCES "courtyard_group_bookings"("id") ON DELETE CASCADE,
  "filename" text NOT NULL, "mime_type" text NOT NULL, "size_bytes" integer NOT NULL, "content_base64" text NOT NULL, "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_courtyard_group_booking_documents_booking" ON "courtyard_group_booking_documents"("group_booking_id");
ALTER TABLE "courtyard_group_room_blocks" ADD COLUMN IF NOT EXISTS "group_booking_id" varchar REFERENCES "courtyard_group_bookings"("id") ON DELETE SET NULL;
ALTER TABLE "courtyard_meeting_events" ADD COLUMN IF NOT EXISTS "group_booking_id" varchar REFERENCES "courtyard_group_bookings"("id") ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS "idx_courtyard_group_room_blocks_booking" ON "courtyard_group_room_blocks"("group_booking_id");
CREATE INDEX IF NOT EXISTS "idx_courtyard_meeting_events_booking" ON "courtyard_meeting_events"("group_booking_id");
