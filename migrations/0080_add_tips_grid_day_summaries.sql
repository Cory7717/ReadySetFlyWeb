CREATE TABLE IF NOT EXISTS tip_grid_day_summaries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  summary_date date NOT NULL,
  pay_period_start date NOT NULL,
  pay_period_end date NOT NULL,
  gross_sales numeric(10, 2) NOT NULL DEFAULT 0,
  notes text,
  updated_by varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_tip_grid_day_summaries_date ON tip_grid_day_summaries (summary_date);
CREATE INDEX IF NOT EXISTS idx_tip_grid_day_summaries_period ON tip_grid_day_summaries (pay_period_start, pay_period_end);
