CREATE TABLE IF NOT EXISTS "aircraft_profiles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" text NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "name" text NOT NULL,
  "cruise_ktas" integer NOT NULL,
  "fuel_burn_gph" numeric(6,2) NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_aircraft_profiles_user" ON "aircraft_profiles" ("user_id");
