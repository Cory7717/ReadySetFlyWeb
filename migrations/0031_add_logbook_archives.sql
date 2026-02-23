CREATE TABLE IF NOT EXISTS "logbook_archives" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "file_name" text NOT NULL,
  "file_size_bytes" integer,
  "storage_provider" text NOT NULL DEFAULT 'object',
  "storage_path" text NOT NULL,
  "page_count" integer,
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_logbook_archives_user" ON "logbook_archives" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_logbook_archives_created" ON "logbook_archives" ("created_at");
