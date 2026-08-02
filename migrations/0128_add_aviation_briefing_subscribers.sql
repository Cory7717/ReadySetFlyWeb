CREATE TABLE IF NOT EXISTS aviation_briefing_subscribers (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(), email varchar NOT NULL UNIQUE, name text,
 status text NOT NULL DEFAULT 'pending', confirmation_token_hash text, unsubscribe_token varchar NOT NULL UNIQUE,
 confirmed_at timestamp, unsubscribed_at timestamp, source text, source_ip text, user_agent text,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_aviation_briefing_subscriber_status ON aviation_briefing_subscribers(status, created_at DESC);
CREATE TABLE IF NOT EXISTS aviation_briefing_email_deliveries (
 id varchar PRIMARY KEY DEFAULT gen_random_uuid(), briefing_id varchar NOT NULL REFERENCES aviation_briefings(id) ON DELETE CASCADE,
 subscriber_id varchar NOT NULL REFERENCES aviation_briefing_subscribers(id) ON DELETE CASCADE,
 status text NOT NULL DEFAULT 'pending', provider_message_id text, error_message text, sent_at timestamp,
 created_at timestamp DEFAULT now(), updated_at timestamp DEFAULT now(), UNIQUE(briefing_id, subscriber_id)
);
CREATE INDEX IF NOT EXISTS idx_aviation_briefing_delivery_status ON aviation_briefing_email_deliveries(status, created_at DESC);
