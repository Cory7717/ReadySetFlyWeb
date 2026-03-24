CREATE TABLE IF NOT EXISTS investor_deck_access_logs (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id varchar REFERENCES users(id),
  ip_address text,
  user_agent text,
  page_path text NOT NULL,
  terms_version text NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_investor_deck_access_created
  ON investor_deck_access_logs (created_at);

CREATE INDEX IF NOT EXISTS idx_investor_deck_access_ip
  ON investor_deck_access_logs (ip_address);

CREATE INDEX IF NOT EXISTS idx_investor_deck_access_user
  ON investor_deck_access_logs (user_id);
