ALTER TABLE cfi_profiles
  ADD COLUMN IF NOT EXISTS is_verified boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS verified_at timestamp,
  ADD COLUMN IF NOT EXISTS verified_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_cfi_profiles_verified_by ON cfi_profiles(verified_by_user_id);
