ALTER TABLE flight_plans
ADD COLUMN IF NOT EXISTS filing_provider text DEFAULT 'leidos_flight_service',
ADD COLUMN IF NOT EXISTS filing_provider_plan_id text,
ADD COLUMN IF NOT EXISTS filing_flight_rules text DEFAULT 'VFR',
ADD COLUMN IF NOT EXISTS filing_status text NOT NULL DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS filing_pending_action text,
ADD COLUMN IF NOT EXISTS filing_is_live boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS filed_at timestamp,
ADD COLUMN IF NOT EXISTS activated_at timestamp,
ADD COLUMN IF NOT EXISTS cancelled_at timestamp,
ADD COLUMN IF NOT EXISTS closed_at timestamp,
ADD COLUMN IF NOT EXISTS filing_last_provider_sync_at timestamp,
ADD COLUMN IF NOT EXISTS filing_raw jsonb,
ADD COLUMN IF NOT EXISTS filing_action_history jsonb NOT NULL DEFAULT '[]'::jsonb;
