CREATE TABLE IF NOT EXISTS "approach_plates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "icao" text,
  "airport_name" text,
  "procedure_name" text NOT NULL,
  "plate_type" text DEFAULT 'IAP',
  "file_name" text NOT NULL,
  "storage_path" text NOT NULL,
  "cycle" text NOT NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_approach_plates_icao" ON "approach_plates" ("icao");
CREATE INDEX IF NOT EXISTS "idx_approach_plates_cycle" ON "approach_plates" ("cycle");
CREATE INDEX IF NOT EXISTS "idx_approach_plates_procedure" ON "approach_plates" ("procedure_name");
