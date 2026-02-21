ALTER TABLE users
  ADD COLUMN IF NOT EXISTS cfi_trial_started_at timestamp,
  ADD COLUMN IF NOT EXISTS cfi_trial_ends_at timestamp,
  ADD COLUMN IF NOT EXISTS cfi_trial_redeemed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cfi_grant_ends_at timestamp,
  ADD COLUMN IF NOT EXISTS cfi_grant_granted_by varchar,
  ADD COLUMN IF NOT EXISTS cfi_grant_granted_at timestamp;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'users_cfi_grant_granted_by_fkey'
  ) THEN
    ALTER TABLE users
      ADD CONSTRAINT users_cfi_grant_granted_by_fkey
      FOREIGN KEY (cfi_grant_granted_by)
      REFERENCES users(id);
  END IF;
END
$$;
