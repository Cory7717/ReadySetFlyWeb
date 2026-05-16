ALTER TABLE tip_entries
  ADD COLUMN IF NOT EXISTS cash_tips numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS credit_tips numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gross_sales numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS covers_served integer,
  ADD COLUMN IF NOT EXISTS shift_type text NOT NULL DEFAULT 'other';
