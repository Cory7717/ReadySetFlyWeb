CREATE TABLE IF NOT EXISTS notam_ingest_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source text DEFAULT 'SWIM_AIM_FNS',
  message_id text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  parsed_notam_count integer NOT NULL,
  reason text NOT NULL,
  missing_fields text[] NOT NULL DEFAULT ARRAY[]::text[],
  event_types text[] NOT NULL DEFAULT ARRAY[]::text[],
  xml_byte_length integer,
  notam_keys text[] NOT NULL DEFAULT ARRAY[]::text[],
  icaos text[] NOT NULL DEFAULT ARRAY[]::text[],
  excerpt text,
  details jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notam_ingest_message ON notam_ingest_events(message_id);
CREATE INDEX IF NOT EXISTS idx_notam_ingest_reason ON notam_ingest_events(reason);
CREATE INDEX IF NOT EXISTS idx_notam_ingest_created ON notam_ingest_events(created_at);
