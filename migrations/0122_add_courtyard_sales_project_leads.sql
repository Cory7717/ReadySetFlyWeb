ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS project_status text;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS estimated_start_date date;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS estimated_completion_date date;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS prime_contractor text;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS engineering_firm text;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS architect text;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS project_manager text;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS known_subcontractors_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS demand_types_json jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS notes text;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS next_action text;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS follow_up_date date;
ALTER TABLE courtyard_sales_regional_prospects ADD COLUMN IF NOT EXISTS assigned_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_courtyard_sales_project_follow_up
  ON courtyard_sales_regional_prospects(hotel_id, follow_up_date)
  WHERE source_type = 'public_project';
