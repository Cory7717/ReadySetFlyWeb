ALTER TABLE banner_ad_orders
  ADD COLUMN IF NOT EXISTS video_orientation text DEFAULT 'landscape';

ALTER TABLE banner_ads
  ADD COLUMN IF NOT EXISTS video_orientation text DEFAULT 'landscape';
