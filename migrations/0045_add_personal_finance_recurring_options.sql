ALTER TABLE personal_finance_entries
  ADD COLUMN IF NOT EXISTS recurring_frequency text,
  ADD COLUMN IF NOT EXISTS recurring_day_of_week integer,
  ADD COLUMN IF NOT EXISTS recurring_interval_days integer;

