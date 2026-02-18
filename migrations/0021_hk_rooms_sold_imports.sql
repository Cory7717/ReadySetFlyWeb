ALTER TABLE "hk_daily_metrics"
  ADD COLUMN IF NOT EXISTS "rooms_sold" integer,
  ADD COLUMN IF NOT EXISTS "total_daily_hours" numeric(6,2),
  ADD COLUMN IF NOT EXISTS "rooms_sold_imported" boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS "rooms_sold_imported_at" timestamp;

CREATE TABLE IF NOT EXISTS "hk_rooms_sold_imports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "uploaded_at" timestamp DEFAULT now(),
  "uploaded_by" varchar REFERENCES "users"("id"),
  "filenames" jsonb,
  "parsed_count" integer DEFAULT 0,
  "updated_count" integer DEFAULT 0,
  "skipped_count" integer DEFAULT 0,
  "conflict_count" integer DEFAULT 0,
  "details" jsonb
);
