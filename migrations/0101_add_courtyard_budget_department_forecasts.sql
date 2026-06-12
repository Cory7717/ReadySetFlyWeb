CREATE TABLE IF NOT EXISTS courtyard_budget_department_forecasts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id text NOT NULL DEFAULT 'courtyard-austin-lakeline',
  department text NOT NULL,
  month integer NOT NULL,
  year integer NOT NULL,
  forecast_revenue numeric(12,2) NOT NULL DEFAULT 0,
  updated_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_courtyard_budget_forecast_period_department
  ON courtyard_budget_department_forecasts(property_id, year, month, department);
