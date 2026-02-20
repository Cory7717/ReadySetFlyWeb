ALTER TABLE banner_ad_orders
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_muted boolean DEFAULT true;

ALTER TABLE banner_ads
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS video_muted boolean DEFAULT true;
