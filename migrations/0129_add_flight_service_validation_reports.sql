CREATE TABLE IF NOT EXISTS flight_service_validation_reports (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id varchar(160) NOT NULL UNIQUE,
  report_json jsonb NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  published_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  published_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flight_service_validation_reports_current
  ON flight_service_validation_reports (is_current, published_at);
