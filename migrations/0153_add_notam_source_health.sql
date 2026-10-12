CREATE TABLE IF NOT EXISTS notam_source_health (
  source text PRIMARY KEY,
  worker_state text,
  connection_state text,
  consumer_state text,
  last_heartbeat_at timestamp,
  last_attempt_at timestamp,
  last_success_at timestamp,
  last_source_update_at timestamp,
  last_message_received_at timestamp,
  last_persisted_at timestamp,
  last_failure_at timestamp,
  last_failure_code text,
  last_result text,
  coverage jsonb,
  updated_at timestamp DEFAULT now()
);

-- Keep each provider's observation independently. Existing records are
-- preserved and retain their current source value.
UPDATE notams SET source = 'swim' WHERE source IS NULL;
ALTER TABLE notams ALTER COLUMN source SET DEFAULT 'swim';
ALTER TABLE notams ALTER COLUMN source SET NOT NULL;
DROP INDEX IF EXISTS idx_notams_unique;
CREATE UNIQUE INDEX IF NOT EXISTS idx_notams_source_unique
  ON notams (source, notam_id);
