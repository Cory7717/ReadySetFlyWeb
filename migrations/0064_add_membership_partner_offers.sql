CREATE TABLE IF NOT EXISTS membership_partner_offers (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  partner_name text NOT NULL,
  slug varchar(120) NOT NULL UNIQUE,
  description text,
  tier text NOT NULL DEFAULT 'pro_plus',
  duration_days integer NOT NULL DEFAULT 90,
  is_active boolean DEFAULT true,
  created_by varchar,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM information_schema.table_constraints
    WHERE constraint_name = 'membership_partner_offers_created_by_users_id_fk'
  ) THEN
    ALTER TABLE membership_partner_offers
      ADD CONSTRAINT membership_partner_offers_created_by_users_id_fk
      FOREIGN KEY (created_by) REFERENCES users(id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_membership_partner_offers_active
  ON membership_partner_offers (is_active);

CREATE INDEX IF NOT EXISTS idx_membership_partner_offers_partner
  ON membership_partner_offers (partner_name);

CREATE TABLE IF NOT EXISTS membership_partner_offer_members (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id varchar NOT NULL REFERENCES membership_partner_offers(id) ON DELETE CASCADE,
  member_number text NOT NULL,
  normalized_member_number varchar(120) NOT NULL,
  redeemed_by_user_id varchar REFERENCES users(id),
  redeemed_at timestamp,
  created_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_partner_offer_members_unique
  ON membership_partner_offer_members (offer_id, normalized_member_number);

CREATE INDEX IF NOT EXISTS idx_membership_partner_offer_members_offer
  ON membership_partner_offer_members (offer_id);

CREATE INDEX IF NOT EXISTS idx_membership_partner_offer_members_redeemed_by
  ON membership_partner_offer_members (redeemed_by_user_id);
