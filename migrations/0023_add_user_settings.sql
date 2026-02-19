CREATE TABLE IF NOT EXISTS "user_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "eb6_output_mode" text DEFAULT 'quick',
  "eb6_selected_outputs" text[] DEFAULT ARRAY[]::text[],
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_user_settings_user" ON "user_settings"("user_id");
CREATE INDEX IF NOT EXISTS "idx_user_settings_user" ON "user_settings"("user_id");
