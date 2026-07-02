ALTER TABLE flight_plans
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS is_certification_test boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS certification_run_id text,
  ADD COLUMN IF NOT EXISTS certification_case_id text,
  ADD COLUMN IF NOT EXISTS certification_case_name text,
  ADD COLUMN IF NOT EXISTS certification_seed integer,
  ADD COLUMN IF NOT EXISTS certification_audit jsonb;

CREATE INDEX IF NOT EXISTS idx_flight_plans_certification_run
  ON flight_plans (certification_run_id);
