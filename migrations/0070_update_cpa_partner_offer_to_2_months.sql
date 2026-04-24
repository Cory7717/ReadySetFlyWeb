-- Migration 0070: Reduce CPA partner offer from 3 months to 2 months
--
-- Keeps the existing slug for link stability while updating the actual
-- offer content and duration to 60 days.

BEGIN;

UPDATE membership_partner_offers
SET
  name = 'CPA 2 Months Free RSF Pro+',
  description = 'Exclusive Cessna Pilots Association member offer for 2 months of RSF Pro+.',
  duration_days = 60,
  updated_at = NOW()
WHERE slug = 'cpa-3mo-pro-plus';

COMMIT;
