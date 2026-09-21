CREATE TABLE IF NOT EXISTS courtyard_revenue_snapshots (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  target_month date NOT NULL,
  snapshot_date date NOT NULL,
  snapshot_time time,
  room_revenue numeric(14,2) NOT NULL,
  rooms_otb integer,
  adr numeric(10,2),
  occupancy numeric(8,5),
  group_pu integer,
  group_unpu integer,
  source_filename text,
  fingerprint text NOT NULL,
  detail_available boolean NOT NULL DEFAULT true,
  source_csv text,
  source_note text,
  created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_courtyard_revenue_snapshot_fingerprint ON courtyard_revenue_snapshots(hotel_id, fingerprint);
CREATE INDEX IF NOT EXISTS idx_courtyard_revenue_snapshot_month ON courtyard_revenue_snapshots(hotel_id, target_month, snapshot_date);

CREATE TABLE IF NOT EXISTS courtyard_revenue_stay_dates (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_id varchar NOT NULL REFERENCES courtyard_revenue_snapshots(id) ON DELETE CASCADE,
  stay_date date NOT NULL,
  rooms_sold integer NOT NULL,
  occupancy numeric(8,5),
  adr numeric(10,2),
  room_revenue numeric(14,2) NOT NULL,
  group_pu integer,
  group_unpu integer
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_courtyard_revenue_stay_date ON courtyard_revenue_stay_dates(snapshot_id, stay_date);

CREATE TABLE IF NOT EXISTS courtyard_revenue_benchmarks (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  target_month date NOT NULL,
  prior_year_revenue numeric(14,2),
  prior_year_rooms integer,
  prior_year_occupancy numeric(8,5),
  prior_year_adr numeric(10,2),
  budget_revenue numeric(14,2),
  budget_rooms integer,
  budget_occupancy numeric(8,5),
  budget_adr numeric(10,2),
  final_actual_revenue numeric(14,2),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_courtyard_revenue_benchmark_month ON courtyard_revenue_benchmarks(hotel_id, target_month);

CREATE TABLE IF NOT EXISTS courtyard_revenue_forecasts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  target_month date NOT NULL,
  forecast_date date NOT NULL,
  forecast_low numeric(14,2) NOT NULL,
  working_forecast numeric(14,2) NOT NULL,
  forecast_high numeric(14,2) NOT NULL,
  note text,
  created_by_user_id varchar REFERENCES tips_users(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_revenue_forecast_month ON courtyard_revenue_forecasts(hotel_id, target_month, forecast_date);

CREATE TABLE IF NOT EXISTS courtyard_revenue_annotations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  hotel_id varchar NOT NULL REFERENCES courtyard_hotels(id) ON DELETE CASCADE,
  annotation_date date NOT NULL,
  target_month date,
  kind text NOT NULL,
  label text NOT NULL,
  note text,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_courtyard_revenue_annotation_month ON courtyard_revenue_annotations(hotel_id, target_month, annotation_date);

INSERT INTO courtyard_revenue_benchmarks (hotel_id,target_month,prior_year_revenue,prior_year_rooms,prior_year_occupancy,prior_year_adr,budget_revenue,budget_rooms,budget_occupancy,budget_adr)
VALUES
('courtyard-austin-lakeline','2026-09-01',179500,NULL,NULL,NULL,210000,NULL,NULL,NULL),
('courtyard-austin-lakeline','2026-10-01',307753,2625,0.7176,117.24,366543,2886,0.7890,127.01),
('courtyard-austin-lakeline','2026-11-01',176880,1831,0.5172,96.60,227228,2185,0.6172,103.99),
('courtyard-austin-lakeline','2026-12-01',132676,1430,0.3909,92.78,183193,1832,0.5008,100.00)
ON CONFLICT (hotel_id,target_month) DO NOTHING;

INSERT INTO courtyard_revenue_snapshots (hotel_id,target_month,snapshot_date,room_revenue,rooms_otb,adr,occupancy,group_pu,group_unpu,fingerprint,detail_available,source_note)
VALUES
('courtyard-austin-lakeline','2026-09-01','2026-09-01',91173.44,NULL,NULL,NULL,NULL,NULL,'workbook-sep-2026-09-01',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-02',97818.62,977,100.12,NULL,NULL,NULL,'workbook-sep-2026-09-02',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-04',103486.31,1039,99.60,NULL,NULL,NULL,'workbook-sep-2026-09-04-am',false,'September 4 AM; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-04',108418.34,1078,100.57,NULL,NULL,NULL,'workbook-sep-2026-09-04-pm',false,'September 4 PM; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-08',119529.75,1201,99.53,0.3497,NULL,NULL,'workbook-sep-2026-09-08',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-09',126355.07,1265,99.89,0.3703,NULL,NULL,'workbook-sep-2026-09-09',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-10',138705.85,1377,100.73,NULL,NULL,NULL,'workbook-sep-2026-09-10',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-12',149908.53,1485,100.95,NULL,NULL,NULL,'workbook-sep-2026-09-12',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-14',161633.58,1605,100.71,NULL,NULL,NULL,'workbook-sep-2026-09-14',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-15',170775.65,1688,101.17,0.4970,NULL,NULL,'workbook-sep-2026-09-15',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-16',177734.31,1751,101.50,0.5141,NULL,NULL,'workbook-sep-2026-09-16',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-17',183022.82,1796,101.91,0.5216,NULL,NULL,'workbook-sep-2026-09-17',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-18',185576.48,1823,101.80,0.5292,NULL,NULL,'workbook-sep-2026-09-18',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-09-01','2026-09-21',197274.35,1947,101.32,0.5645,NULL,NULL,'workbook-sep-2026-09-21',false,'Verified workbook aggregate; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-10-01','2026-09-16',106302.28,788,134.90,0.2184,NULL,NULL,'workbook-oct-2026-09-16',false,'30/60/90 workbook baseline; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-11-01','2026-09-16',27927.85,302,92.48,0.0860,NULL,NULL,'workbook-nov-2026-09-16',false,'30/60/90 workbook baseline; stay-date detail unavailable'),
('courtyard-austin-lakeline','2026-12-01','2026-09-16',4410.55,46,95.88,0.0127,NULL,NULL,'workbook-dec-2026-09-16',false,'30/60/90 workbook baseline; stay-date detail unavailable')
ON CONFLICT (hotel_id,fingerprint) DO NOTHING;

INSERT INTO courtyard_revenue_forecasts (hotel_id,target_month,forecast_date,forecast_low,working_forecast,forecast_high,note)
SELECT 'courtyard-austin-lakeline','2026-09-01',v.forecast_date,v.low,v.working,v.high,v.note FROM (VALUES
('2026-09-10'::date,175000,180000,185000,'Pickup accelerated; first major upward revision'),
('2026-09-12'::date,180000,185000,190000,'Continued strong pickup'),
('2026-09-14'::date,185000,190000,195000,'Pace remained strong'),
('2026-09-15'::date,195000,200000,205000,'Approaching prior-year final rapidly'),
('2026-09-16'::date,200000,205000,210000,'Budget became reasonable upside'),
('2026-09-17'::date,207000,210000,212000,'Strong transient pickup continued'),
('2026-09-18'::date,205000,210000,215000,'Late-month pickup deceleration observed'),
('2026-09-21'::date,215000,219000,222000,'Weekend pickup kept late-month pace strong')
) AS v(forecast_date,low,working,high,note)
WHERE EXISTS (SELECT 1 FROM courtyard_hotels WHERE id='courtyard-austin-lakeline')
AND NOT EXISTS (SELECT 1 FROM courtyard_revenue_forecasts f WHERE f.hotel_id='courtyard-austin-lakeline' AND f.target_month='2026-09-01' AND f.forecast_date=v.forecast_date);

INSERT INTO courtyard_revenue_annotations (hotel_id,annotation_date,target_month,kind,label,note)
SELECT 'courtyard-austin-lakeline','2026-09-01','2026-09-01','milestone','Sparrow Hospitality onboarding','Sales onboarding milestone; no pickup is attributed to it automatically.'
WHERE EXISTS (SELECT 1 FROM courtyard_hotels WHERE id='courtyard-austin-lakeline')
AND NOT EXISTS (SELECT 1 FROM courtyard_revenue_annotations WHERE hotel_id='courtyard-austin-lakeline' AND label='Sparrow Hospitality onboarding');
