ALTER TABLE tip_banquet_reports
  ADD COLUMN IF NOT EXISTS assigned_associates_json jsonb NOT NULL DEFAULT '[]'::jsonb;
