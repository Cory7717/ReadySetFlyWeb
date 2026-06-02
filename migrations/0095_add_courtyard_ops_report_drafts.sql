CREATE TABLE IF NOT EXISTS "courtyard_ops_report_drafts" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  "week_start" date NOT NULL,
  "week_end" date NOT NULL,
  "week_label" text NOT NULL DEFAULT 'Week 1',
  "payload_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "uploaded_reports_json" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "updated_by" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_courtyard_ops_report_week"
  ON "courtyard_ops_report_drafts" ("property_id", "week_start");

CREATE INDEX IF NOT EXISTS "idx_courtyard_ops_report_updated"
  ON "courtyard_ops_report_drafts" ("updated_at");

CREATE TABLE IF NOT EXISTS "courtyard_ops_report_user_settings" (
  "user_id" varchar PRIMARY KEY REFERENCES "tips_users"("id") ON DELETE CASCADE,
  "last_week_start" date,
  "updated_at" timestamp DEFAULT now()
);
