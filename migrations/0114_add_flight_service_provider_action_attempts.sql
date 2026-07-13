CREATE TABLE IF NOT EXISTS flight_service_provider_action_attempts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  flight_plan_id varchar NOT NULL REFERENCES flight_plans(id) ON DELETE CASCADE,
  user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'leidos',
  action text NOT NULL,
  idempotency_key text,
  request_fingerprint varchar(128) NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  status_reason text,
  provider_plan_id text,
  version_stamp text,
  response_status_code integer,
  response_plan jsonb,
  response_body jsonb,
  error_code text,
  error_message text,
  dispatched_at timestamp,
  completed_at timestamp,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_flight_service_provider_action_attempts_plan
  ON flight_service_provider_action_attempts(flight_plan_id);

CREATE INDEX IF NOT EXISTS idx_flight_service_provider_action_attempts_user
  ON flight_service_provider_action_attempts(user_id);

CREATE INDEX IF NOT EXISTS idx_flight_service_provider_action_attempts_status
  ON flight_service_provider_action_attempts(status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_service_provider_action_attempts_key
  ON flight_service_provider_action_attempts(flight_plan_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flight_service_provider_action_attempts_active_action
  ON flight_service_provider_action_attempts(flight_plan_id, action)
  WHERE status IN ('pending', 'dispatched', 'provider-outcome-unknown');
