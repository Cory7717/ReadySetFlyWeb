ALTER TABLE "flying_clubs"
  ADD COLUMN IF NOT EXISTS "require_policy_acceptance_before_booking" boolean NOT NULL DEFAULT true;

ALTER TABLE "flying_club_documents"
  ADD COLUMN IF NOT EXISTS "file_name" text,
  ADD COLUMN IF NOT EXISTS "storage_provider" text NOT NULL DEFAULT 'object',
  ADD COLUMN IF NOT EXISTS "mime_type" text,
  ADD COLUMN IF NOT EXISTS "version" text NOT NULL DEFAULT '1.0',
  ADD COLUMN IF NOT EXISTS "requires_acceptance" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "is_active" boolean NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS "flying_club_legal_acceptances" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "document_id" varchar NOT NULL REFERENCES "flying_club_documents"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "version" text NOT NULL,
  "accepted_at" timestamp DEFAULT now(),
  "ip" text,
  "user_agent" text
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_legal_acceptances_club" ON "flying_club_legal_acceptances" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_legal_acceptances_user" ON "flying_club_legal_acceptances" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_flying_club_legal_acceptance" ON "flying_club_legal_acceptances" ("document_id", "user_id", "version");
