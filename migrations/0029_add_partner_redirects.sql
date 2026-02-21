CREATE TABLE IF NOT EXISTS "partner_redirects" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "partner" text NOT NULL,
  "user_id" varchar REFERENCES "users"("id"),
  "session_id" text,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_partner_redirects_partner" ON "partner_redirects" ("partner");
CREATE INDEX IF NOT EXISTS "idx_partner_redirects_user" ON "partner_redirects" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_partner_redirects_created" ON "partner_redirects" ("created_at");
