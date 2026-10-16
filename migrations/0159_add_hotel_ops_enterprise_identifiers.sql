-- Additive enterprise identifiers and property-onboarding state for INNTRIX.
-- Organization numbers begin at 10000 and remain strings so leading zeroes and
-- future expansion do not affect internal UUID relationships.
CREATE SEQUENCE IF NOT EXISTS hotel_ops_organization_number_seq START WITH 10000;
CREATE SEQUENCE IF NOT EXISTS hotel_ops_property_identifier_seq START WITH 1;

ALTER TABLE hotel_ops_organizations
  ADD COLUMN IF NOT EXISTS organization_number varchar(12);

UPDATE hotel_ops_organizations
SET organization_number = lpad(nextval('hotel_ops_organization_number_seq')::text, 5, '0')
WHERE organization_number IS NULL;

SELECT setval(
  'hotel_ops_organization_number_seq',
  GREATEST(
    9999,
    COALESCE((SELECT MAX(organization_number::bigint) FROM hotel_ops_organizations WHERE organization_number ~ '^[0-9]+$'), 9999)
  ),
  true
);

ALTER TABLE hotel_ops_organizations
  ALTER COLUMN organization_number SET DEFAULT lpad(nextval('hotel_ops_organization_number_seq')::text, 5, '0'),
  ALTER COLUMN organization_number SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_organization_number
  ON hotel_ops_organizations(organization_number);

ALTER TABLE hotel_ops_hotels
  ADD COLUMN IF NOT EXISTS property_identifier varchar(24),
  ADD COLUMN IF NOT EXISTS inn_code varchar(80),
  ADD COLUMN IF NOT EXISTS accounting_code varchar(80),
  ADD COLUMN IF NOT EXISTS onboarding_status text;

UPDATE hotel_ops_hotels
SET property_identifier = 'HTL-' || lpad(nextval('hotel_ops_property_identifier_seq')::text, 6, '0')
WHERE property_identifier IS NULL;

-- Properties that predate the onboarding workflow remain operational.
UPDATE hotel_ops_hotels
SET onboarding_status = 'operational'
WHERE onboarding_status IS NULL;

SELECT setval(
  'hotel_ops_property_identifier_seq',
  GREATEST(
    1,
    COALESCE((SELECT MAX(substring(property_identifier from '[0-9]+$')::bigint) FROM hotel_ops_hotels), 0)
  ),
  EXISTS (SELECT 1 FROM hotel_ops_hotels)
);

ALTER TABLE hotel_ops_hotels
  ALTER COLUMN property_identifier SET DEFAULT ('HTL-' || lpad(nextval('hotel_ops_property_identifier_seq')::text, 6, '0')),
  ALTER COLUMN property_identifier SET NOT NULL,
  ALTER COLUMN onboarding_status SET DEFAULT 'registered',
  ALTER COLUMN onboarding_status SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'chk_hotel_ops_onboarding_status'
  ) THEN
    ALTER TABLE hotel_ops_hotels
      ADD CONSTRAINT chk_hotel_ops_onboarding_status
      CHECK (onboarding_status IN (
        'registered',
        'pending_regional_setup',
        'gm_invited',
        'gm_accepted',
        'operational'
      ));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_property_identifier
  ON hotel_ops_hotels(property_identifier);
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_inn_code
  ON hotel_ops_hotels(organization_id, inn_code)
  WHERE inn_code IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uniq_hotel_ops_accounting_code
  ON hotel_ops_hotels(organization_id, accounting_code)
  WHERE accounting_code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_hotel_ops_hotel_onboarding
  ON hotel_ops_hotels(organization_id, onboarding_status);

CREATE OR REPLACE FUNCTION prevent_hotel_ops_organization_number_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.organization_number IS DISTINCT FROM OLD.organization_number THEN
    RAISE EXCEPTION 'organization_number is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION prevent_hotel_ops_property_identifier_change()
RETURNS trigger AS $$
BEGIN
  IF NEW.property_identifier IS DISTINCT FROM OLD.property_identifier THEN
    RAISE EXCEPTION 'property_identifier is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_hotel_ops_organization_number_immutable ON hotel_ops_organizations;
CREATE TRIGGER trg_hotel_ops_organization_number_immutable
BEFORE UPDATE ON hotel_ops_organizations
FOR EACH ROW EXECUTE FUNCTION prevent_hotel_ops_organization_number_change();

DROP TRIGGER IF EXISTS trg_hotel_ops_property_identifier_immutable ON hotel_ops_hotels;
CREATE TRIGGER trg_hotel_ops_property_identifier_immutable
BEFORE UPDATE ON hotel_ops_hotels
FOR EACH ROW EXECUTE FUNCTION prevent_hotel_ops_property_identifier_change();
