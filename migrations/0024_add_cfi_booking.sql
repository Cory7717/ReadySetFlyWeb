CREATE TABLE IF NOT EXISTS "cfi_profiles" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "slug" text NOT NULL,
  "display_name" text NOT NULL,
  "headline" text,
  "bio" text,
  "location_city" text,
  "location_state" text,
  "airport_home" text,
  "hourly_rate_cents" integer,
  "ratings_held" jsonb DEFAULT '[]'::jsonb,
  "aircraft_types" jsonb DEFAULT '[]'::jsonb,
  "languages" jsonb DEFAULT '[]'::jsonb,
  "contact_note" text,
  "preferred_payments" text,
  "is_published" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_cfi_profiles_user" ON "cfi_profiles"("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_cfi_profiles_slug" ON "cfi_profiles"("slug");
CREATE INDEX IF NOT EXISTS "idx_cfi_profiles_slug" ON "cfi_profiles"("slug");

CREATE TABLE IF NOT EXISTS "cfi_credentials" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "cfi_profile_id" varchar NOT NULL REFERENCES "cfi_profiles"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "file_url" text NOT NULL,
  "file_name" text NOT NULL,
  "uploaded_at" timestamp DEFAULT now(),
  "expires_on" date,
  "notes" text
);

CREATE INDEX IF NOT EXISTS "idx_cfi_credentials_profile" ON "cfi_credentials"("cfi_profile_id");

CREATE TABLE IF NOT EXISTS "cfi_availability_rules" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "cfi_profile_id" varchar NOT NULL REFERENCES "cfi_profiles"("id") ON DELETE CASCADE,
  "timezone" text NOT NULL,
  "weekday" integer NOT NULL,
  "start_time" time NOT NULL,
  "end_time" time NOT NULL,
  "is_active" boolean DEFAULT true
);

CREATE INDEX IF NOT EXISTS "idx_cfi_availability_profile" ON "cfi_availability_rules"("cfi_profile_id");

CREATE TABLE IF NOT EXISTS "cfi_booking_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "cfi_profile_id" varchar NOT NULL REFERENCES "cfi_profiles"("id") ON DELETE CASCADE,
  "student_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "requested_start" timestamp NOT NULL,
  "requested_end" timestamp NOT NULL,
  "timezone" text NOT NULL,
  "location" text,
  "session_type" text NOT NULL,
  "notes" text,
  "status" text NOT NULL DEFAULT 'REQUESTED',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_cfi_booking_profile_status" ON "cfi_booking_requests"("cfi_profile_id", "status");
CREATE INDEX IF NOT EXISTS "idx_cfi_booking_student" ON "cfi_booking_requests"("student_user_id");

CREATE TABLE IF NOT EXISTS "cfi_legal_acceptances" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "acceptance_type" text NOT NULL,
  "accepted_at" timestamp DEFAULT now(),
  "ip" text,
  "user_agent" text,
  "version" text NOT NULL
);

CREATE INDEX IF NOT EXISTS "idx_cfi_legal_user" ON "cfi_legal_acceptances"("user_id");
