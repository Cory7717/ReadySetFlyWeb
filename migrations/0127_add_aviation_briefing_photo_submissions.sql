CREATE TABLE IF NOT EXISTS aviation_briefing_photo_submissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), submission_token varchar NOT NULL UNIQUE,
  contributor_name text NOT NULL, contributor_email varchar NOT NULL, phone text, home_airport text, city_state text,
  preferred_credit text NOT NULL, profile_url text, aircraft_make_model text, aircraft_registration text,
  photo_location text, date_taken text, description text, story_context text, suggested_topic text, identifiable_people text,
  image_storage_key text NOT NULL, original_filename text NOT NULL, stored_filename text NOT NULL, mime_type text NOT NULL,
  file_size integer NOT NULL, image_width integer, image_height integer,
  ownership_confirmed boolean NOT NULL, permission_accepted boolean NOT NULL, permission_text text NOT NULL,
  permission_version text NOT NULL, consented_at timestamp NOT NULL,
  user_id varchar REFERENCES users(id) ON DELETE SET NULL, source_ip text, user_agent text,
  review_status text NOT NULL DEFAULT 'pending', internal_notes text,
  publication_status text NOT NULL DEFAULT 'unpublished', associated_briefing_id varchar REFERENCES aviation_briefings(id) ON DELETE SET NULL,
  published_image_url text, final_credit_line text, alt_text text, caption text, image_title text,
  relevant_aircraft_type text, relevant_airport text, created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aviation_photo_status ON aviation_briefing_photo_submissions(review_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_aviation_photo_email ON aviation_briefing_photo_submissions(contributor_email);
CREATE INDEX IF NOT EXISTS idx_aviation_photo_article ON aviation_briefing_photo_submissions(associated_briefing_id);
