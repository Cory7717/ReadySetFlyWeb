CREATE TABLE IF NOT EXISTS "cfi_schools" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "location_city" text,
  "location_state" text,
  "airport_home" text,
  "website" text,
  "phone" text,
  "logo_url" text,
  "is_published" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_cfi_schools_slug" ON "cfi_schools"("slug");
CREATE INDEX IF NOT EXISTS "idx_cfi_schools_owner" ON "cfi_schools"("owner_user_id");

CREATE TABLE IF NOT EXISTS "cfi_school_members" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "school_id" varchar NOT NULL REFERENCES "cfi_schools"("id") ON DELETE cascade,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "role" text NOT NULL DEFAULT 'instructor',
  "status" text NOT NULL DEFAULT 'active',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_cfi_school_members" ON "cfi_school_members"("school_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_cfi_school_members_school" ON "cfi_school_members"("school_id");
CREATE INDEX IF NOT EXISTS "idx_cfi_school_members_user" ON "cfi_school_members"("user_id");

ALTER TABLE "cfi_profiles"
ADD COLUMN IF NOT EXISTS "school_id" varchar REFERENCES "cfi_schools"("id") ON DELETE set null;

CREATE INDEX IF NOT EXISTS "idx_cfi_profiles_school" ON "cfi_profiles"("school_id");
