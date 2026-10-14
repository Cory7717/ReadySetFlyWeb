-- Additive Hotel Operations Phase 2 administration and durable support records.
ALTER TABLE hotel_ops_organizations ADD COLUMN IF NOT EXISTS profile jsonb NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE IF NOT EXISTS hotel_ops_support_specialists (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE CASCADE,
  enabled boolean NOT NULL DEFAULT true, email_notifications boolean NOT NULL DEFAULT true,
  escalation_recipient boolean NOT NULL DEFAULT true, presence_status text NOT NULL DEFAULT 'offline',
  last_heartbeat_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_support_specialist_account ON hotel_ops_support_specialists(account_id);

CREATE TABLE IF NOT EXISTS hotel_ops_support_settings (
  id varchar PRIMARY KEY DEFAULT 'platform', live_chat_enabled boolean NOT NULL DEFAULT true,
  tickets_enabled boolean NOT NULL DEFAULT true, escalation_emails_enabled boolean NOT NULL DEFAULT true,
  first_response_seconds integer NOT NULL DEFAULT 120 CHECK (first_response_seconds BETWEEN 30 AND 3600),
  secondary_escalation_enabled boolean NOT NULL DEFAULT false,
  secondary_escalation_seconds integer NOT NULL DEFAULT 600 CHECK (secondary_escalation_seconds BETWEEN 120 AND 86400),
  availability_message text NOT NULL DEFAULT 'Our support team will respond as soon as possible.',
  updated_by_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL, updated_at timestamp NOT NULL DEFAULT now()
);
INSERT INTO hotel_ops_support_settings(id) VALUES ('platform') ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS hotel_ops_support_conversations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), reference varchar(32) NOT NULL UNIQUE,
  organization_id varchar NOT NULL REFERENCES hotel_ops_organizations(id) ON DELETE CASCADE,
  hotel_id varchar REFERENCES hotel_ops_hotels(id) ON DELETE SET NULL,
  requester_account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE RESTRICT,
  assigned_specialist_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  type text NOT NULL CHECK (type IN ('live_chat','ticket')), subject text, category text,
  priority text NOT NULL DEFAULT 'normal', status text NOT NULL DEFAULT 'waiting',
  first_response_deadline_at timestamp, first_human_response_at timestamp, escalated_at timestamp, resolved_at timestamp,
  last_activity_at timestamp NOT NULL DEFAULT now(), requester_unread_count integer NOT NULL DEFAULT 0,
  support_unread_count integer NOT NULL DEFAULT 0, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_support_org_activity ON hotel_ops_support_conversations(organization_id, last_activity_at DESC);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_support_queue ON hotel_ops_support_conversations(status, type, last_activity_at DESC);

CREATE TABLE IF NOT EXISTS hotel_ops_support_messages (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id varchar NOT NULL REFERENCES hotel_ops_support_conversations(id) ON DELETE CASCADE,
  sender_account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE RESTRICT,
  sender_type text NOT NULL CHECK (sender_type IN ('requester','support')), body text NOT NULL CHECK (char_length(body) BETWEEN 1 AND 8000),
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_support_messages_conversation ON hotel_ops_support_messages(conversation_id, created_at, id);

CREATE TABLE IF NOT EXISTS hotel_ops_support_assignments (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id varchar NOT NULL REFERENCES hotel_ops_support_conversations(id) ON DELETE CASCADE,
  specialist_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  assigned_by_account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE RESTRICT,
  action text NOT NULL, created_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hotel_ops_support_notifications (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id varchar NOT NULL REFERENCES hotel_ops_support_conversations(id) ON DELETE CASCADE,
  kind text NOT NULL, due_at timestamp NOT NULL, status text NOT NULL DEFAULT 'queued', attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamp NOT NULL, lease_expires_at timestamp, provider_accepted_at timestamp,
  last_error_code varchar(80), created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_support_notification ON hotel_ops_support_notifications(conversation_id, kind);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_support_notification_due ON hotel_ops_support_notifications(status, next_attempt_at);
