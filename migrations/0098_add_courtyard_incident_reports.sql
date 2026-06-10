CREATE TABLE IF NOT EXISTS "courtyard_incident_reports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "property_id" text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  "incident_number" text NOT NULL,
  "incident_date" date NOT NULL,
  "incident_time" text NOT NULL,
  "location" text NOT NULL,
  "category" text NOT NULL,
  "severity" text NOT NULL DEFAULT 'moderate',
  "status" text NOT NULL DEFAULT 'open',
  "reported_by_name" text NOT NULL,
  "reported_by_position" text,
  "reported_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "people_involved" text,
  "guest_rooms" text,
  "witnesses" text,
  "description" text NOT NULL,
  "immediate_actions" text NOT NULL,
  "injuries" text,
  "property_damage" text,
  "vehicle_details" text,
  "emergency_services" text,
  "police_report_number" text,
  "notifications" text,
  "follow_up_required" text,
  "manager_notes" text,
  "payload_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "email_sent_at" timestamp,
  "email_error" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

ALTER TABLE "courtyard_incident_reports"
  ADD COLUMN IF NOT EXISTS "email_sent_at" timestamp;

ALTER TABLE "courtyard_incident_reports"
  ADD COLUMN IF NOT EXISTS "email_error" text;

CREATE UNIQUE INDEX IF NOT EXISTS "idx_courtyard_incident_number"
  ON "courtyard_incident_reports" ("incident_number");

CREATE INDEX IF NOT EXISTS "idx_courtyard_incident_date"
  ON "courtyard_incident_reports" ("incident_date");

CREATE INDEX IF NOT EXISTS "idx_courtyard_incident_status"
  ON "courtyard_incident_reports" ("status");

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
