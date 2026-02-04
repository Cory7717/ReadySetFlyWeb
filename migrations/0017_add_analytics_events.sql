CREATE TABLE IF NOT EXISTS "analytics_events" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "event" text NOT NULL,
  "page" text,
  "visitor_id" text NOT NULL,
  "user_id" varchar REFERENCES "users"("id"),
  "meta" jsonb,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_analytics_events_created" ON "analytics_events" ("created_at");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_event" ON "analytics_events" ("event");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_page" ON "analytics_events" ("page");
CREATE INDEX IF NOT EXISTS "idx_analytics_events_visitor" ON "analytics_events" ("visitor_id");
