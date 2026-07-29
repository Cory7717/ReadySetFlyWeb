CREATE TABLE IF NOT EXISTS courtyard_sales_monthly_targets (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  target_year integer NOT NULL,
  target_month integer NOT NULL,
  segment text NOT NULL,
  target_room_nights numeric(14,2) NOT NULL,
  target_revenue numeric(16,2) NOT NULL,
  target_adr numeric(14,2) NOT NULL,
  stretch_room_nights numeric(14,2) NOT NULL,
  stretch_revenue numeric(16,2) NOT NULL,
  stretch_adr numeric(14,2) NOT NULL,
  baseline_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  rationale text,
  status text NOT NULL DEFAULT 'draft',
  source_fingerprint text NOT NULL,
  locked_at timestamp,
  created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  updated_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT courtyard_sales_monthly_target_segment CHECK (segment IN ('Group', 'Special Corp')),
  CONSTRAINT courtyard_sales_monthly_target_status CHECK (status IN ('draft', 'locked')),
  CONSTRAINT courtyard_sales_monthly_target_month CHECK (target_month BETWEEN 1 AND 12)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courtyard_sales_monthly_target_unique
  ON courtyard_sales_monthly_targets(hotel_id, target_year, target_month, segment);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_monthly_target_period
  ON courtyard_sales_monthly_targets(hotel_id, target_year, target_month);
