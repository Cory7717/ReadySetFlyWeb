CREATE TABLE IF NOT EXISTS courtyard_sales_advisor_analyses (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  analysis_type text NOT NULL,
  lookback_months integer NOT NULL,
  business_types_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  request_parameters_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  source_fingerprint text NOT NULL,
  input_snapshot_json jsonb NOT NULL,
  result_json jsonb,
  model text NOT NULL,
  prompt_version text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_courtyard_sales_advisor_recent
  ON courtyard_sales_advisor_analyses(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_advisor_fingerprint
  ON courtyard_sales_advisor_analyses(hotel_id, source_fingerprint);
