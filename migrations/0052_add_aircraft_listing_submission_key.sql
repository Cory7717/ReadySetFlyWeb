ALTER TABLE aircraft_listings
ADD COLUMN IF NOT EXISTS submission_key text;

CREATE UNIQUE INDEX IF NOT EXISTS uidx_aircraft_owner_submission_key
ON aircraft_listings (owner_id, submission_key);
