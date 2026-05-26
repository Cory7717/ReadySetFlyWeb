ALTER TABLE tip_grid_day_summaries
  ADD COLUMN IF NOT EXISTS tax_amount numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS beer_sales numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS liquor_sales numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS food_sales numeric(10, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS wine_sales numeric(10, 2) NOT NULL DEFAULT 0;
