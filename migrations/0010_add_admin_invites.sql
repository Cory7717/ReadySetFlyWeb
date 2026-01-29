ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_role" text;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_permissions" text[] NOT NULL DEFAULT ARRAY[]::text[];

CREATE TABLE IF NOT EXISTS "admin_invites" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar NOT NULL,
  "role" text NOT NULL,
  "permissions" text[] NOT NULL DEFAULT ARRAY[]::text[],
  "token" text NOT NULL UNIQUE,
  "invited_by" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "expires_at" timestamp NOT NULL,
  "accepted_at" timestamp,
  "created_at" timestamp DEFAULT now()
);
