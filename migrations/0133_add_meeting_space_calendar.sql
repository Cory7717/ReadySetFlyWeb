CREATE TABLE IF NOT EXISTS "courtyard_meeting_spaces" (
 "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE,
 "name" text NOT NULL, "square_feet" integer NOT NULL DEFAULT 2000, "active" boolean NOT NULL DEFAULT true, "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
); CREATE UNIQUE INDEX IF NOT EXISTS "uniq_courtyard_meeting_space_name" ON "courtyard_meeting_spaces"("hotel_id","name");
CREATE TABLE IF NOT EXISTS "courtyard_meeting_events" (
 "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE, "space_id" varchar NOT NULL REFERENCES "courtyard_meeting_spaces"("id") ON DELETE RESTRICT,
 "group_name" text NOT NULL, "event_name" text NOT NULL, "event_date" date NOT NULL, "setup_start_time" time NOT NULL, "guest_start_time" time NOT NULL, "guest_end_time" time NOT NULL, "breakdown_end_time" time NOT NULL,
 "status" text NOT NULL DEFAULT 'inquiry', "hold_expires_at" timestamp, "attendance" integer, "square_feet_required" integer, "room_setup" text, "sales_owner" text,
 "client_name" text, "client_email" text, "client_phone" text, "expected_revenue" numeric(12,2), "expected_room_nights" integer,
 "catering_notes" text, "av_notes" text, "accessibility_notes" text, "internal_notes" text, "account_key" text,
 "opportunity_id" varchar REFERENCES "courtyard_sales_opportunities"("id") ON DELETE SET NULL, "conflict_override_reason" text,
 "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "updated_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
 "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
); CREATE INDEX IF NOT EXISTS "idx_courtyard_meeting_events_date" ON "courtyard_meeting_events"("hotel_id","event_date"); CREATE INDEX IF NOT EXISTS "idx_courtyard_meeting_events_space" ON "courtyard_meeting_events"("space_id","event_date"); CREATE INDEX IF NOT EXISTS "idx_courtyard_meeting_events_status" ON "courtyard_meeting_events"("status");
CREATE TABLE IF NOT EXISTS "courtyard_meeting_event_documents" (
 "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "event_id" varchar NOT NULL REFERENCES "courtyard_meeting_events"("id") ON DELETE CASCADE, "filename" text NOT NULL,
 "mime_type" text NOT NULL, "size_bytes" integer NOT NULL, "category" text NOT NULL DEFAULT 'other', "content_base64" text NOT NULL,
 "uploaded_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "created_at" timestamp DEFAULT now()
); CREATE INDEX IF NOT EXISTS "idx_courtyard_meeting_documents_event" ON "courtyard_meeting_event_documents"("event_id");
CREATE TABLE IF NOT EXISTS "courtyard_meeting_calendar_shares" (
 "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE, "token_hash" text NOT NULL UNIQUE,
 "recipient_name" text, "range_start" date, "range_end" date, "expires_at" timestamp NOT NULL, "revoked_at" timestamp, "access_count" integer NOT NULL DEFAULT 0,
 "last_accessed_at" timestamp, "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "created_at" timestamp DEFAULT now()
); CREATE INDEX IF NOT EXISTS "idx_courtyard_meeting_shares_hotel" ON "courtyard_meeting_calendar_shares"("hotel_id");
