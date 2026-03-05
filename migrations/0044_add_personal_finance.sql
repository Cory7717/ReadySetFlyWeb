CREATE TABLE IF NOT EXISTS personal_finance_entries (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  owner text NOT NULL,
  month text NOT NULL,
  type text NOT NULL,
  category text NOT NULL,
  rsf_category text,
  subcategory text,
  description text,
  amount numeric(10, 2) NOT NULL,
  due_date date,
  is_paid boolean DEFAULT false,
  paid_date date,
  is_recurring boolean DEFAULT false,
  recurring_day_of_month integer,
  notify_days_before integer DEFAULT 3,
  notification_sent boolean DEFAULT false,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now()
);

CREATE TABLE IF NOT EXISTS personal_finance_budgets (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  month text NOT NULL,
  category text NOT NULL,
  owner text NOT NULL,
  budget_amount numeric(10, 2) NOT NULL,
  created_at timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personal_finance_entries_month
  ON personal_finance_entries(month);
CREATE INDEX IF NOT EXISTS idx_personal_finance_entries_owner
  ON personal_finance_entries(owner);
CREATE INDEX IF NOT EXISTS idx_personal_finance_entries_type
  ON personal_finance_entries(type);
CREATE INDEX IF NOT EXISTS idx_personal_finance_entries_due_date
  ON personal_finance_entries(due_date);
CREATE INDEX IF NOT EXISTS idx_personal_finance_entries_unpaid_due
  ON personal_finance_entries(is_paid, due_date);

CREATE INDEX IF NOT EXISTS idx_personal_finance_budgets_month
  ON personal_finance_budgets(month);
CREATE INDEX IF NOT EXISTS idx_personal_finance_budgets_owner
  ON personal_finance_budgets(owner);
CREATE UNIQUE INDEX IF NOT EXISTS idx_personal_finance_budgets_unique
  ON personal_finance_budgets(month, category, owner);
