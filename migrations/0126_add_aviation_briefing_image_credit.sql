ALTER TABLE aviation_briefings
  ADD COLUMN IF NOT EXISTS featured_image_credit text,
  ADD COLUMN IF NOT EXISTS featured_image_credit_url text;
