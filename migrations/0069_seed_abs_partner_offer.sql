-- Migration 0069: Seed American Bonanza Society partner offer
--
-- Safe to re-run. Inserts the ABS offer only if the slug does not already exist.

BEGIN;

INSERT INTO membership_partner_offers (
  id,
  name,
  partner_name,
  slug,
  description,
  tier,
  duration_days,
  is_active,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  'ABS 2 Months Free RSF Pro+',
  'American Bonanza Society',
  'abs-2mo-pro-plus',
  'Exclusive American Bonanza Society member offer for 2 months of RSF Pro+.',
  'pro_plus',
  60,
  true,
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1
  FROM membership_partner_offers
  WHERE slug = 'abs-2mo-pro-plus'
);

COMMIT;
