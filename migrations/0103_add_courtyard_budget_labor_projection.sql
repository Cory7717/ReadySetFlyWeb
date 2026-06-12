ALTER TABLE courtyard_budget_department_forecasts
  ADD COLUMN IF NOT EXISTS labor_projection_json jsonb NOT NULL DEFAULT '{}'::jsonb;
