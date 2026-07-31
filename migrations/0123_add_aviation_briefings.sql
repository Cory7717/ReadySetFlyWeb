CREATE TABLE IF NOT EXISTS aviation_briefings (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  slug varchar(180) NOT NULL,
  excerpt text NOT NULL,
  content_type text NOT NULL DEFAULT 'article',
  category text NOT NULL,
  status text NOT NULL DEFAULT 'draft',
  is_featured boolean NOT NULL DEFAULT false,
  featured_image_url text,
  featured_image_storage_key text,
  featured_image_alt text,
  article_content_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  video_source_type text,
  video_url text,
  video_storage_key text,
  video_thumbnail_url text,
  video_duration_seconds integer,
  video_transcript text,
  supporting_content_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  contributors_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  relevant_tool_ids_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  seo_title text,
  seo_description text,
  published_at timestamp,
  scheduled_at timestamp,
  created_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  updated_by_user_id varchar REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamp DEFAULT now(),
  updated_at timestamp DEFAULT now(),
  CONSTRAINT aviation_briefings_content_type_check CHECK (content_type IN ('article', 'video')),
  CONSTRAINT aviation_briefings_status_check CHECK (status IN ('draft', 'review', 'scheduled', 'published', 'archived')),
  CONSTRAINT aviation_briefings_video_source_check CHECK (video_source_type IS NULL OR video_source_type IN ('youtube', 'vimeo', 'uploaded'))
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_aviation_briefings_slug ON aviation_briefings (slug);
CREATE INDEX IF NOT EXISTS idx_aviation_briefings_visibility ON aviation_briefings (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_aviation_briefings_category ON aviation_briefings (category);
CREATE INDEX IF NOT EXISTS idx_aviation_briefings_type ON aviation_briefings (content_type);
CREATE INDEX IF NOT EXISTS idx_aviation_briefings_featured ON aviation_briefings (is_featured);
