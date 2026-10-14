-- Additive, isolated enterprise hotel operations control plane.
CREATE TABLE IF NOT EXISTS hotel_ops_organizations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL,
  slug varchar(100) NOT NULL UNIQUE, status text NOT NULL DEFAULT 'active',
  is_demo boolean NOT NULL DEFAULT false, created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hotel_ops_accounts (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), email varchar(320) NOT NULL UNIQUE,
  display_name text NOT NULL, password_hash text NOT NULL, status text NOT NULL DEFAULT 'active',
  last_login_at timestamp, created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hotel_ops_organization_memberships (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), organization_id varchar NOT NULL REFERENCES hotel_ops_organizations(id) ON DELETE CASCADE,
  account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE CASCADE, role text NOT NULL,
  status text NOT NULL DEFAULT 'active', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_org_membership ON hotel_ops_organization_memberships(organization_id, account_id);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_org_membership_account ON hotel_ops_organization_memberships(account_id, status);
CREATE TABLE IF NOT EXISTS hotel_ops_hotels (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), organization_id varchar NOT NULL REFERENCES hotel_ops_organizations(id) ON DELETE CASCADE,
  property_code varchar(40) NOT NULL, name text NOT NULL, brand text, property_type text,
  ownership_entity text, management_entity text, street_address text, city text NOT NULL, state varchar(80) NOT NULL,
  postal_code varchar(24), country varchar(80) NOT NULL DEFAULT 'US', phone varchar(40), time_zone varchar(80) NOT NULL,
  room_count integer, active_room_count integer, meeting_room_count integer, food_beverage_outlet_count integer,
  pms_provider text, reporting_platform text, accounting_system text, labor_scheduling_system text, brand_reporting_ecosystem text,
  business_day_cutoff time, currency varchar(3) NOT NULL DEFAULT 'USD', departments jsonb NOT NULL DEFAULT '[]'::jsonb,
  enabled_modules jsonb NOT NULL DEFAULT '[]'::jsonb, report_source_types jsonb NOT NULL DEFAULT '[]'::jsonb,
  reporting_integration_status text NOT NULL DEFAULT 'not_configured',
  status text NOT NULL DEFAULT 'active', created_by_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_property_code ON hotel_ops_hotels(organization_id, property_code);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_hotels_org_status ON hotel_ops_hotels(organization_id, status);
CREATE TABLE IF NOT EXISTS hotel_ops_hotel_memberships (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES hotel_ops_hotels(id) ON DELETE CASCADE,
  account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE CASCADE, role text NOT NULL, status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_hotel_membership ON hotel_ops_hotel_memberships(hotel_id, account_id);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_hotel_membership_account ON hotel_ops_hotel_memberships(account_id, status);
CREATE TABLE IF NOT EXISTS hotel_ops_module_permissions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE CASCADE,
  hotel_id varchar NOT NULL REFERENCES hotel_ops_hotels(id) ON DELETE CASCADE, module_key varchar(80) NOT NULL,
  can_view boolean NOT NULL DEFAULT true, can_manage boolean NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_module_permission ON hotel_ops_module_permissions(account_id, hotel_id, module_key);
CREATE TABLE IF NOT EXISTS hotel_ops_invitations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), organization_id varchar NOT NULL REFERENCES hotel_ops_organizations(id) ON DELETE CASCADE,
  hotel_id varchar REFERENCES hotel_ops_hotels(id) ON DELETE CASCADE, email varchar(320) NOT NULL, role text NOT NULL,
  module_keys jsonb NOT NULL DEFAULT '[]'::jsonb, token_hash varchar(64) NOT NULL UNIQUE, expires_at timestamp NOT NULL,
  accepted_at timestamp, revoked_at timestamp, invited_by_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  accepted_by_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL, created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_invite_lookup ON hotel_ops_invitations(email, expires_at);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_invite_org ON hotel_ops_invitations(organization_id, created_at);
CREATE TABLE IF NOT EXISTS hotel_ops_sessions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE, csrf_token_hash varchar(64) NOT NULL, expires_at timestamp NOT NULL,
  last_seen_at timestamp NOT NULL DEFAULT now(), revoked_at timestamp, created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_sessions_account ON hotel_ops_sessions(account_id, expires_at);
CREATE TABLE IF NOT EXISTS hotel_ops_password_resets (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE CASCADE,
  token_hash varchar(64) NOT NULL UNIQUE, expires_at timestamp NOT NULL, used_at timestamp, created_at timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS hotel_ops_audit_events (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), organization_id varchar REFERENCES hotel_ops_organizations(id) ON DELETE SET NULL,
  hotel_id varchar REFERENCES hotel_ops_hotels(id) ON DELETE SET NULL, actor_account_id varchar REFERENCES hotel_ops_accounts(id) ON DELETE SET NULL,
  action varchar(100) NOT NULL, target_type varchar(80), target_id varchar(100), metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_audit_org_created ON hotel_ops_audit_events(organization_id, created_at);
CREATE TABLE IF NOT EXISTS hotel_ops_reporting_configurations (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(), hotel_id varchar NOT NULL REFERENCES hotel_ops_hotels(id) ON DELETE CASCADE,
  report_type varchar(80) NOT NULL, format_key varchar(100), configuration jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'not_configured', created_at timestamp NOT NULL DEFAULT now(), updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_reporting_config ON hotel_ops_reporting_configurations(hotel_id, report_type);
