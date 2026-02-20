CREATE TABLE IF NOT EXISTS "tfms_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "type" text NOT NULL,
  "severity" text NOT NULL,
  "dep_icao" text,
  "dest_icao" text,
  "corridor_geom" jsonb,
  "effective_start" timestamp,
  "effective_end" timestamp,
  "details" jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_tfms_events_dep" ON "tfms_events" ("dep_icao");
CREATE INDEX IF NOT EXISTS "idx_tfms_events_dest" ON "tfms_events" ("dest_icao");
CREATE INDEX IF NOT EXISTS "idx_tfms_events_effective" ON "tfms_events" ("effective_start");

CREATE TABLE IF NOT EXISTS "tfms_overlays" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "bbox" text NOT NULL,
  "geojson" jsonb NOT NULL,
  "generated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_tfms_overlays_bbox" ON "tfms_overlays" ("bbox");
CREATE INDEX IF NOT EXISTS "idx_tfms_overlays_generated" ON "tfms_overlays" ("generated_at");
