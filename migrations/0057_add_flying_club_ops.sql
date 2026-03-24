CREATE TABLE IF NOT EXISTS "flying_club_squawks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "aircraft_id" varchar NOT NULL REFERENCES "flying_club_aircraft"("id") ON DELETE CASCADE,
  "reported_by_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "description" text,
  "severity" text NOT NULL DEFAULT 'minor',
  "status" text NOT NULL DEFAULT 'open',
  "grounds_aircraft" boolean NOT NULL DEFAULT false,
  "reported_at" timestamp DEFAULT now(),
  "resolved_at" timestamp,
  "resolved_by_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "resolution_notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_squawks_club" ON "flying_club_squawks" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_squawks_aircraft" ON "flying_club_squawks" ("aircraft_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_squawks_status" ON "flying_club_squawks" ("status");

CREATE TABLE IF NOT EXISTS "flying_club_maintenance_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "aircraft_id" varchar NOT NULL REFERENCES "flying_club_aircraft"("id") ON DELETE CASCADE,
  "created_by_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "completed_by_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "item_type" text NOT NULL DEFAULT 'maintenance',
  "title" text NOT NULL,
  "description" text,
  "status" text NOT NULL DEFAULT 'open',
  "due_date" timestamp,
  "due_hours" numeric(10,1),
  "blocks_scheduling" boolean NOT NULL DEFAULT false,
  "compliance_reference" text,
  "notes" text,
  "completed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_maintenance_club" ON "flying_club_maintenance_items" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_maintenance_aircraft" ON "flying_club_maintenance_items" ("aircraft_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_maintenance_status" ON "flying_club_maintenance_items" ("status");

CREATE TABLE IF NOT EXISTS "flying_club_blackouts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "aircraft_id" varchar NOT NULL REFERENCES "flying_club_aircraft"("id") ON DELETE CASCADE,
  "created_by_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "title" text NOT NULL,
  "reason" text,
  "status" text NOT NULL DEFAULT 'active',
  "start_at" timestamp NOT NULL,
  "end_at" timestamp NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_blackouts_club" ON "flying_club_blackouts" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_blackouts_aircraft" ON "flying_club_blackouts" ("aircraft_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_blackouts_start" ON "flying_club_blackouts" ("start_at");
