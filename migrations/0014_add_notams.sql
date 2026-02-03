CREATE TABLE IF NOT EXISTS "notams" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "icao" text NOT NULL,
  "notam_id" text NOT NULL,
  "text" text NOT NULL,
  "effective_at" timestamp,
  "expires_at" timestamp,
  "source" text DEFAULT 'swim',
  "raw" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_notams_unique" ON "notams" ("notam_id");
CREATE INDEX IF NOT EXISTS "idx_notams_icao" ON "notams" ("icao");
