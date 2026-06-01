ALTER TABLE "vehicle_listings"
  ADD COLUMN IF NOT EXISTS "view_count" integer DEFAULT 1530 NOT NULL;

UPDATE "vehicle_listings"
SET "view_count" = GREATEST(COALESCE("view_count", 0), 1530)
WHERE "id" = '1974-vw-super-beetle-convertible';

CREATE INDEX IF NOT EXISTS "idx_vehicle_listings_view_count" ON "vehicle_listings" ("view_count");
