CREATE TABLE IF NOT EXISTS "aviation_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "title" text NOT NULL,
  "description" text NOT NULL,
  "location" text NOT NULL,
  "category" text NOT NULL,
  "event_url" text,
  "created_by" varchar REFERENCES "users"("id"),
  "start_date" timestamp NOT NULL,
  "end_date" timestamp NOT NULL,
  "is_sample" boolean DEFAULT false,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "aviation_events_start_date_idx" ON "aviation_events" ("start_date");
CREATE INDEX IF NOT EXISTS "aviation_events_end_date_idx" ON "aviation_events" ("end_date");
