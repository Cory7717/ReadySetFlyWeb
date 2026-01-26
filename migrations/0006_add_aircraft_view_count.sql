ALTER TABLE "aircraft_listings" ADD COLUMN IF NOT EXISTS "view_count" integer NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS "idx_aircraft_view_count" ON "aircraft_listings" ("view_count");
