ALTER TABLE hotel_ops_support_specialists
  ADD COLUMN IF NOT EXISTS support_role text NOT NULL DEFAULT 'support_specialist';

CREATE TABLE IF NOT EXISTS hotel_ops_support_invitations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  email varchar(320) NOT NULL,
  support_role text NOT NULL CHECK (support_role IN ('support_specialist','support_administrator')),
  token_hash varchar(64) NOT NULL UNIQUE,
  expires_at timestamp NOT NULL,
  accepted_at timestamp,
  revoked_at timestamp,
  invited_by_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  accepted_by_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_support_invite_email ON hotel_ops_support_invitations(email, expires_at);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_active_support_invite
  ON hotel_ops_support_invitations(lower(email)) WHERE accepted_at IS NULL AND revoked_at IS NULL;
