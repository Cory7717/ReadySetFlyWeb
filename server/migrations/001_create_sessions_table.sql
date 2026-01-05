-- Migration: Create `sessions` table for connect-pg-simple
-- Run this against the Postgres database used by `process.env.DATABASE_URL`.

BEGIN;

CREATE TABLE IF NOT EXISTS sessions (
  sid varchar NOT NULL,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);

ALTER TABLE sessions
  ADD CONSTRAINT sessions_pkey PRIMARY KEY (sid);

CREATE INDEX IF NOT EXISTS IDX_sessions_expire ON sessions (expire);

COMMIT;

-- Notes:
-- - This matches the schema expected by `connect-pg-simple` when using
--   `tableName: "sessions"`.
-- - After applying, restart your server so the session store can use the table.
