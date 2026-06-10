CREATE TABLE IF NOT EXISTS "courtyard_ops_monthly_summaries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  "report_month" text NOT NULL,
  "payload_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_courtyard_ops_monthly_summary_period"
  ON "courtyard_ops_monthly_summaries" ("property_id", "report_month");

CREATE INDEX IF NOT EXISTS "idx_courtyard_ops_monthly_summary_updated"
  ON "courtyard_ops_monthly_summaries" ("updated_at");
