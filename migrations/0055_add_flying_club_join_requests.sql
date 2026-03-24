CREATE TABLE IF NOT EXISTS "flying_club_join_requests" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "club_id" varchar NOT NULL REFERENCES "flying_clubs"("id") ON DELETE CASCADE,
  "applicant_user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text NOT NULL DEFAULT 'pending',
  "message" text,
  "reviewed_by_user_id" varchar REFERENCES "users"("id") ON DELETE SET NULL,
  "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flying_club_join_requests_club" ON "flying_club_join_requests" ("club_id");
CREATE INDEX IF NOT EXISTS "idx_flying_club_join_requests_applicant" ON "flying_club_join_requests" ("applicant_user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_flying_club_join_request_pending" ON "flying_club_join_requests" ("club_id", "applicant_user_id", "status");
