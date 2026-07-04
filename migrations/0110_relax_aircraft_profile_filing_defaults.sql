ALTER TABLE aircraft_profiles
  ALTER COLUMN fuel_burn_gph DROP NOT NULL,
  ALTER COLUMN max_range_nm DROP NOT NULL,
  ALTER COLUMN service_ceiling_ft DROP NOT NULL,
  ALTER COLUMN wake_category DROP NOT NULL,
  ALTER COLUMN equipment_codes DROP NOT NULL,
  ALTER COLUMN surveillance_codes DROP NOT NULL;
