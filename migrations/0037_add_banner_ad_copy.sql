ALTER TABLE banner_ad_orders
  ADD COLUMN IF NOT EXISTS ad_copy text;

ALTER TABLE banner_ads
  ADD COLUMN IF NOT EXISTS ad_copy text;
