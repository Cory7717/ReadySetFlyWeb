CREATE TABLE IF NOT EXISTS membership_promotions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  code varchar(120) NOT NULL UNIQUE,
  normalized_code varchar(120) NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  campaign text,
  partner_name text,
  source text,
  benefit_type text NOT NULL DEFAULT 'complimentary_membership',
  membership_tier text NOT NULL DEFAULT 'premium',
  membership_duration_months integer NOT NULL DEFAULT 12,
  max_total_redemptions integer,
  max_redemptions_per_user integer NOT NULL DEFAULT 1,
  redemption_count integer NOT NULL DEFAULT 0,
  valid_from timestamp DEFAULT now(),
  expires_at timestamp,
  is_active boolean NOT NULL DEFAULT true,
  success_message text,
  created_by varchar REFERENCES users(id),
  updated_by varchar REFERENCES users(id),
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_membership_promotions_active ON membership_promotions(is_active);
CREATE INDEX IF NOT EXISTS idx_membership_promotions_campaign ON membership_promotions(campaign);
CREATE INDEX IF NOT EXISTS idx_membership_promotions_expires ON membership_promotions(expires_at);

CREATE TABLE IF NOT EXISTS membership_promotion_redemptions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id varchar NOT NULL REFERENCES membership_promotions(id),
  user_id varchar NOT NULL REFERENCES users(id),
  normalized_code varchar(120) NOT NULL,
  redeemed_at timestamp NOT NULL DEFAULT now(),
  membership_tier_granted text NOT NULL,
  membership_starts_at timestamp NOT NULL,
  membership_ends_at timestamp NOT NULL,
  previous_membership_tier text,
  previous_membership_expires_at timestamp,
  registration_session_id text,
  ip_hash varchar(64),
  user_agent_summary text
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_promotion_redemptions_unique_user
  ON membership_promotion_redemptions(promotion_id, user_id);
CREATE INDEX IF NOT EXISTS idx_membership_promotion_redemptions_promotion
  ON membership_promotion_redemptions(promotion_id);
CREATE INDEX IF NOT EXISTS idx_membership_promotion_redemptions_user
  ON membership_promotion_redemptions(user_id);

INSERT INTO membership_promotions (
  code,
  normalized_code,
  name,
  description,
  campaign,
  partner_name,
  source,
  benefit_type,
  membership_tier,
  membership_duration_months,
  max_total_redemptions,
  max_redemptions_per_user,
  expires_at,
  is_active,
  success_message
) VALUES (
  'ABS2026WINNER',
  'ABS2026WINNER',
  'ABS Member Dinner Winner',
  'One complimentary year of Ready Set Fly Premium. Annual value: $89.99.',
  'AirVenture 2026 Member Dinner Giveaway',
  'American Bonanza Society',
  'ABS Member Dinner Giveaway',
  'complimentary_membership',
  'premium',
  12,
  5,
  1,
  '2026-12-31 23:59:59',
  true,
  'Congratulations! As an American Bonanza Society Member Dinner Giveaway Winner, you have received one complimentary year of Ready Set Fly Premium. Your membership includes access to current Premium features and eligible new Premium capabilities released during your membership. We appreciate the opportunity to welcome ABS members to Ready Set Fly and would love your feedback as the platform continues to grow.'
) ON CONFLICT (normalized_code) DO NOTHING;
