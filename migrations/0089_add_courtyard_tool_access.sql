ALTER TABLE tips_users
  ADD COLUMN IF NOT EXISTS tool_access_json jsonb NOT NULL DEFAULT '{}'::jsonb;
