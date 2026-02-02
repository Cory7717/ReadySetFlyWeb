CREATE TABLE IF NOT EXISTS "notification_preferences" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "email_enabled" boolean DEFAULT true,
  "push_enabled" boolean DEFAULT true,
  "in_app_enabled" boolean DEFAULT true,
  "alert_days_before" integer DEFAULT 30,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_notification_preferences_user" ON "notification_preferences" ("user_id");

CREATE TABLE IF NOT EXISTS "push_tokens" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "token" text NOT NULL UNIQUE,
  "platform" text,
  "device_name" text,
  "is_active" boolean DEFAULT true,
  "last_used_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_push_tokens_user" ON "push_tokens" ("user_id");

CREATE TABLE IF NOT EXISTS "user_notifications" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "title" text NOT NULL,
  "message" text NOT NULL,
  "reference_date" date,
  "channels" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "is_read" boolean DEFAULT false,
  "read_at" timestamp,
  "meta" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_notifications_reference" ON "user_notifications" ("user_id", "type", "reference_date");
CREATE INDEX IF NOT EXISTS "idx_user_notifications_user" ON "user_notifications" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_notifications_unread" ON "user_notifications" ("user_id", "is_read");

CREATE TABLE IF NOT EXISTS "endorsements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "endorsement_type" text,
  "issued_at" date NOT NULL,
  "expires_at" date,
  "instructor_name" text,
  "instructor_certificate" text,
  "aircraft_type" text,
  "notes" text,
  "document_url" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_endorsements_user" ON "endorsements" ("user_id");

CREATE TABLE IF NOT EXISTS "radio_comms_sessions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "scenario_id" text NOT NULL,
  "score_correct" integer DEFAULT 0,
  "score_total" integer DEFAULT 0,
  "duration_sec" integer,
  "attempts" jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_radio_comms_sessions_user" ON "radio_comms_sessions" ("user_id");
