ALTER TABLE marketplace_listings
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text;

ALTER TABLE banner_ads
  ADD COLUMN IF NOT EXISTS instagram_url text,
  ADD COLUMN IF NOT EXISTS facebook_url text;
