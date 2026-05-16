ALTER TABLE tips_users
  ADD COLUMN IF NOT EXISTS must_change_password boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS disabled_at timestamp,
  ADD COLUMN IF NOT EXISTS disabled_by varchar;

UPDATE tips_users
SET must_change_password = false
WHERE must_change_password IS NULL;
