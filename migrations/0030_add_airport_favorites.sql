CREATE TABLE IF NOT EXISTS "airport_favorites" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "icao" text NOT NULL,
  "name" text,
  "city" text,
  "state" text,
  "alert_ifr" boolean DEFAULT false,
  "alert_mvfr" boolean DEFAULT false,
  "last_observed_category" text,
  "last_observed_at" timestamp,
  "last_alert_category" text,
  "last_alert_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  UNIQUE ("user_id", "icao")
);

CREATE INDEX IF NOT EXISTS "idx_airport_favorites_user" ON "airport_favorites" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_airport_favorites_icao" ON "airport_favorites" ("icao");
CREATE INDEX IF NOT EXISTS "idx_airport_favorites_alerts" ON "airport_favorites" ("alert_ifr", "alert_mvfr");
