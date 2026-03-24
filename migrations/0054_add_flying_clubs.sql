CREATE TABLE IF NOT EXISTS "flying_clubs" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "slug" text NOT NULL,
  "description" text,
  "home_airport" text,
  "city" text,
  "state" text,
  "website_url" text,
  "contact_email" text,
  "contact_phone" text,
  "visibility" text NOT NULL DEFAULT 'listed',
  "status" text NOT NULL DEFAULT 'draft',
  "requires_approval" boolean NOT NULL DEFAULT true,
  "booking_notes" text,
  "policies_summary" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_flying_clubs_slug" ON "flying_clubs" ("slug");
CREATE INDEX IF NOT EXISTS "idx_flying_clubs_owner" ON "flying_clubs" ("owner_user_id");
CREATE INDEX IF NOT EXISTS "idx_flying_clubs_status" ON "flying_clubs" ("status");
CREATE INDEX IF NOT EXISTS "idx_flying_clubs_visibility" ON "flying_clubs" ("visibility");

CREATE TABLE IF NOT EXISTS "flying_club_members" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'member',
  "status" text NOT NULL DEFAULT 'active',
  "joined_at" timestamp DEFAULT now(),
  "invited_by_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_flying_club_membership" ON "flying_club_members" ("club_id", "user_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_members_club" ON "flying_club_members" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_members_user" ON "flying_club_members" ("user_id");

CREATE TABLE IF NOT EXISTS "flying_club_aircraft" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "aircraft_listing_id" varchar REFERENCES "aircraft_listings"("id") ON DELETE SET NULL,
  "display_name" text NOT NULL,
  "tail_number" text,
  "make_model" text,
  "hourly_rate_wet" numeric(10,2),
  "hourly_rate_dry" numeric(10,2),
  "status" text NOT NULL DEFAULT 'active',
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_aircraft_club" ON "flying_club_aircraft" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_aircraft_listing" ON "flying_club_aircraft" ("aircraft_listing_id");

CREATE TABLE IF NOT EXISTS "flying_club_reservations" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "aircraft_id" varchar NOT NULL REFERENCES "flying_club_aircraft"("id") ON DELETE CASCADE,
  "member_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "start_at" timestamp NOT NULL,
  "end_at" timestamp NOT NULL,
  "status" text NOT NULL DEFAULT 'confirmed',
  "purpose" text,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_reservations_club" ON "flying_club_reservations" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_reservations_aircraft" ON "flying_club_reservations" ("aircraft_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_reservations_member" ON "flying_club_reservations" ("member_user_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_reservations_start" ON "flying_club_reservations" ("start_at");

CREATE TABLE IF NOT EXISTS "flying_club_announcements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "author_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "is_pinned" boolean NOT NULL DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_announcements_club" ON "flying_club_announcements" ("club_id");

CREATE TABLE IF NOT EXISTS "flying_club_documents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "uploaded_by_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "category" text NOT NULL DEFAULT 'general',
  "storage_path" text NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_documents_club" ON "flying_club_documents" ("club_id");
