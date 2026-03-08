ALTER TABLE users
  ADD COLUMN IF NOT EXISTS membership_grant_tier text,
  ADD COLUMN IF NOT EXISTS membership_grant_ends_at timestamp,
  ADD COLUMN IF NOT EXISTS membership_grant_granted_by varchar,
  ADD COLUMN IF NOT EXISTS membership_grant_granted_at timestamp,
  ADD COLUMN IF NOT EXISTS membership_grant_reason text;
