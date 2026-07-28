CREATE TABLE IF NOT EXISTS courtyard_sales_account_profiles (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  normalized_account_key text NOT NULL,
  contact_name text,
  phone text,
  email text,
  updated_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courtyard_sales_profile_account
  ON courtyard_sales_account_profiles(hotel_id, normalized_account_key);

CREATE TABLE IF NOT EXISTS courtyard_sales_account_notes (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id varchar NOT NULL REFERENCES courtyard_sales_account_profiles(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_notes_profile
  ON courtyard_sales_account_notes(profile_id, created_at);
