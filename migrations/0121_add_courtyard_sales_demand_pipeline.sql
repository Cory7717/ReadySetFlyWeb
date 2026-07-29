CREATE TABLE IF NOT EXISTS courtyard_sales_demand_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  event_name text NOT NULL, category text NOT NULL, start_date date NOT NULL, end_date date, venue text, city text,
  distance_miles numeric(8,2), demand_level text NOT NULL DEFAULT 'medium', opportunity_types_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_roles_json jsonb NOT NULL DEFAULT '[]'::jsonb, recommended_action text, booking_window_days integer,
  source_name text, source_url text, evidence_status text NOT NULL DEFAULT 'manual', confidence text NOT NULL DEFAULT 'medium',
  source_last_verified_at timestamp, created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_demand_period ON courtyard_sales_demand_events(hotel_id, start_date);

CREATE TABLE IF NOT EXISTS courtyard_sales_regional_prospects (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  company_name text NOT NULL, address text, city text, latitude numeric(10,7), longitude numeric(10,7), distance_miles numeric(8,2),
  distance_band text, industry text, website text, phone text, evidence_class text NOT NULL DEFAULT 'local_prospect',
  source_type text NOT NULL DEFAULT 'manual', source_id text, source_url text, opportunity_signals_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  target_roles_json jsonb NOT NULL DEFAULT '[]'::jsonb, historical_account_key text, historical_room_nights numeric(14,2),
  historical_revenue numeric(16,2), opportunity_score integer NOT NULL DEFAULT 0, rationale text, status text NOT NULL DEFAULT 'new',
  last_verified_at timestamp, created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_regional_score ON courtyard_sales_regional_prospects(hotel_id, opportunity_score);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courtyard_sales_regional_source ON courtyard_sales_regional_prospects(hotel_id, source_type, source_id);
