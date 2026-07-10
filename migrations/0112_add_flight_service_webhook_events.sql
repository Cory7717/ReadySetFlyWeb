CREATE TABLE IF NOT EXISTS flight_service_webhook_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'leidos',
  event_fingerprint varchar(128) NOT NULL,
  flight_identifier text,
  provider_plan_id text,
  version_stamp text,
  raw_flight_state text,
  raw_artcc_state text,
  message_date_time text,
  provider_message_id text,
  notification_type text,
  processing_id varchar(64) NOT NULL,
  status text NOT NULL DEFAULT 'processing',
  duplicate_count integer NOT NULL DEFAULT 0,
  payload_summary jsonb,
  processing_started_at timestamp NOT NULL DEFAULT now(),
  processing_finished_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_service_webhook_events_provider_fingerprint
  ON flight_service_webhook_events(provider, event_fingerprint);

CREATE INDEX IF NOT EXISTS idx_flight_service_webhook_events_flight_identifier
  ON flight_service_webhook_events(flight_identifier);

CREATE INDEX IF NOT EXISTS idx_flight_service_webhook_events_provider_plan
  ON flight_service_webhook_events(provider_plan_id);

CREATE INDEX IF NOT EXISTS idx_flight_service_webhook_events_created
  ON flight_service_webhook_events(created_at);
