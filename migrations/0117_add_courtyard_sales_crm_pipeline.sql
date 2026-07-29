CREATE TABLE IF NOT EXISTS courtyard_sales_opportunities (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE, normalized_account_key text NOT NULL, account_name text NOT NULL,
 stage text NOT NULL DEFAULT 'prospect', arrival_date date, departure_date date, estimated_room_nights numeric(14,2) NOT NULL DEFAULT 0, estimated_revenue numeric(16,2) NOT NULL DEFAULT 0,
 market_segment text, next_action text, next_action_at timestamp, owner_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL, notes text,
 created_by varchar REFERENCES tips_users(id) ON DELETE SET NULL, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_opportunity_hotel_stage ON courtyard_sales_opportunities(hotel_id, stage);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_opportunity_next_action ON courtyard_sales_opportunities(hotel_id, next_action_at);
CREATE TABLE IF NOT EXISTS courtyard_sales_activities (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE, normalized_account_key text NOT NULL, account_name text NOT NULL,
 opportunity_id varchar REFERENCES courtyard_sales_opportunities(id) ON DELETE SET NULL, activity_type text NOT NULL, outcome text, details text, next_follow_up_at timestamp,
 created_by varchar REFERENCES tips_users(id) ON DELETE SET NULL, created_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_activity_hotel_created ON courtyard_sales_activities(hotel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_courtyard_sales_activity_account ON courtyard_sales_activities(hotel_id, normalized_account_key);
CREATE TABLE IF NOT EXISTS courtyard_sales_weekly_reports (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE, week_start date NOT NULL,
 status text NOT NULL DEFAULT 'draft', narrative_json jsonb NOT NULL DEFAULT '{}'::jsonb, submitted_at timestamp,
 updated_by varchar REFERENCES tips_users(id) ON DELETE SET NULL, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_courtyard_sales_weekly_report_period ON courtyard_sales_weekly_reports(hotel_id, week_start);
