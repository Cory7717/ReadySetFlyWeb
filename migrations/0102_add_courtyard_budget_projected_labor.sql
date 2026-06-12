ALTER TABLE courtyard_budget_department_forecasts
  ADD COLUMN IF NOT EXISTS projected_labor numeric(12,2) NOT NULL DEFAULT 0;
