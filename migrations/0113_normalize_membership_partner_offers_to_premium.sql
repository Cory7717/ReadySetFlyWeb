-- Migration 0113: Normalize partner membership offers to the current two-tier model.
--
-- RSF now exposes only Basic (Free) and Premium. Legacy pro/pro_plus offer rows remain
-- compatible in code, but active partner offers should display and grant Premium.

BEGIN;

UPDATE membership_partner_offers
SET
  name = 'ABS 2 Months Free RSF Premium',
  description = 'Exclusive American Bonanza Society member offer for 2 months of RSF Premium.',
  tier = 'premium',
  updated_at = NOW()
WHERE slug = 'abs-2mo-pro-plus';

UPDATE membership_partner_offers
SET
  name = 'CPA 2 Months Free RSF Premium',
  description = 'Exclusive Cessna Pilots Association member offer for 2 months of RSF Premium.',
  tier = 'premium',
  updated_at = NOW()
WHERE slug = 'cpa-3mo-pro-plus';

COMMIT;
