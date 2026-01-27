CREATE TABLE IF NOT EXISTS "aircraft_types" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "make" text NOT NULL,
  "model" text NOT NULL,
  "icao_type" text,
  "category" text NOT NULL,
  "engine_type" text NOT NULL,
  "cruise_ktas" numeric(6,2) NOT NULL,
  "fuel_burn_gph" numeric(6,2) NOT NULL,
  "usable_fuel_gal" numeric(8,2) NOT NULL,
  "max_gross_weight_lb" numeric(10,2) NOT NULL,
  "default_altitude_ft" integer,
  "is_verified" boolean DEFAULT false,
  "source_note" text,
  "updated_at" timestamp DEFAULT now(),
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_aircraft_types_make_model" ON "aircraft_types" ("make", "model");
CREATE INDEX IF NOT EXISTS "idx_aircraft_types_icao" ON "aircraft_types" ("icao_type");

ALTER TABLE "aircraft_profiles"
  ADD COLUMN IF NOT EXISTS "tail_number" text,
  ADD COLUMN IF NOT EXISTS "type_id" uuid REFERENCES "aircraft_types"("id") ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS "cruise_ktas_override" numeric(6,2),
  ADD COLUMN IF NOT EXISTS "fuel_burn_override_gph" numeric(6,2),
  ADD COLUMN IF NOT EXISTS "usable_fuel_override_gal" numeric(8,2),
  ADD COLUMN IF NOT EXISTS "max_gross_weight_override_lb" numeric(10,2),
  ADD COLUMN IF NOT EXISTS "updated_at" timestamp DEFAULT now();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'aircraft_profiles'
      AND column_name = 'cruise_ktas'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'aircraft_profiles'
      AND column_name = 'cruise_ktas_override'
  ) THEN
    ALTER TABLE "aircraft_profiles" RENAME COLUMN "cruise_ktas" TO "cruise_ktas_override";
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'aircraft_profiles'
      AND column_name = 'fuel_burn_gph'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'aircraft_profiles'
      AND column_name = 'fuel_burn_override_gph'
  ) THEN
    ALTER TABLE "aircraft_profiles" RENAME COLUMN "fuel_burn_gph" TO "fuel_burn_override_gph";
  END IF;
END $$;
