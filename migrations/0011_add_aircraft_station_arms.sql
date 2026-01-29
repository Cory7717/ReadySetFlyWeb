ALTER TABLE aircraft_types
  ADD COLUMN IF NOT EXISTS empty_arm_in numeric(6, 2),
  ADD COLUMN IF NOT EXISTS front_arm_in numeric(6, 2),
  ADD COLUMN IF NOT EXISTS rear_arm_in numeric(6, 2),
  ADD COLUMN IF NOT EXISTS baggage_arm_in numeric(6, 2),
  ADD COLUMN IF NOT EXISTS fuel_arm_in numeric(6, 2);
