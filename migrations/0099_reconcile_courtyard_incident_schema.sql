ALTER TABLE "courtyard_incident_reports"
  ADD COLUMN IF NOT EXISTS "email_sent_at" timestamp;

ALTER TABLE "courtyard_incident_reports"
  ADD COLUMN IF NOT EXISTS "email_error" text;

CREATE TABLE IF NOT EXISTS "courtyard_incident_evidence" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "incident_id" varchar NOT NULL REFERENCES "courtyard_incident_reports"("id") ON DELETE CASCADE,
  "evidence_type" text NOT NULL,
  "storage_path" text NOT NULL,
  "original_file_name" text NOT NULL,
  "mime_type" text NOT NULL,
  "size" integer NOT NULL,
  "duration_seconds" integer,
  "uploaded_by" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "uploaded_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_courtyard_incident_evidence_incident"
  ON "courtyard_incident_evidence" ("incident_id");

CREATE TABLE IF NOT EXISTS "courtyard_incident_share_links" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "incident_id" varchar NOT NULL REFERENCES "courtyard_incident_reports"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL,
  "expires_at" timestamp NOT NULL,
  "revoked_at" timestamp,
  "created_by" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_courtyard_incident_share_token"
  ON "courtyard_incident_share_links" ("token_hash");

CREATE INDEX IF NOT EXISTS "idx_courtyard_incident_share_incident"
  ON "courtyard_incident_share_links" ("incident_id");
