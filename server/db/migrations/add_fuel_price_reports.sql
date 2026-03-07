CREATE TABLE IF NOT EXISTS fuel_price_reports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  icao          VARCHAR(5) NOT NULL,
  fuel_type     VARCHAR(20) NOT NULL,
  price_ppg     NUMERIC(6, 3) NOT NULL,
  fbo_name      VARCHAR(200),
  notes         TEXT,
  reported_by   VARCHAR(100) NOT NULL,
  reported_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verified      BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_fuel_reports_icao
  ON fuel_price_reports (icao);

CREATE INDEX IF NOT EXISTS idx_fuel_reports_reported_at
  ON fuel_price_reports (reported_at DESC);

CREATE INDEX IF NOT EXISTS idx_fuel_reports_icao_type
  ON fuel_price_reports (icao, fuel_type, reported_at DESC);
