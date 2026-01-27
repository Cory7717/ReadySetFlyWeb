CREATE TABLE IF NOT EXISTS student_profiles (
  user_id varchar PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  wizard_json jsonb,
  roadmap_json jsonb,
  progress_json jsonb,
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_student_profiles_user ON student_profiles(user_id);
