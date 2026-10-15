-- Additive regional portfolio scope for INNTRIX Hotel Operations.
CREATE TABLE IF NOT EXISTS hotel_ops_regions (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id varchar NOT NULL REFERENCES hotel_ops_organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  code varchar(40),
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_region_name
  ON hotel_ops_regions(organization_id, name);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_region_code
  ON hotel_ops_regions(organization_id, code)
  WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotel_ops_regions_org_status
  ON hotel_ops_regions(organization_id, status);

CREATE TABLE IF NOT EXISTS hotel_ops_region_memberships (
  id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  region_id varchar NOT NULL REFERENCES hotel_ops_regions(id) ON DELETE CASCADE,
  account_id varchar NOT NULL REFERENCES hotel_ops_accounts(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_region_membership
  ON hotel_ops_region_memberships(region_id, account_id);
CREATE INDEX IF NOT EXISTS idx_hotel_ops_region_membership_account
  ON hotel_ops_region_memberships(account_id, status);

ALTER TABLE hotel_ops_hotels
  ADD COLUMN IF NOT EXISTS region_id varchar REFERENCES hotel_ops_regions(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_hotel_ops_hotels_region
  ON hotel_ops_hotels(region_id, status);

ALTER TABLE hotel_ops_invitations
  ADD COLUMN IF NOT EXISTS region_ids jsonb NOT NULL DEFAULT '[]'::jsonb;
