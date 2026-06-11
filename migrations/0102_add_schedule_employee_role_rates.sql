ALTER TABLE schedule_employees
  ADD COLUMN IF NOT EXISTS role_rates_json jsonb;
