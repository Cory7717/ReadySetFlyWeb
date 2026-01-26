CREATE TABLE IF NOT EXISTS "logbook_pro_settings" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "medical_class" text,
  "medical_issued_at" date,
  "medical_expires_at" date,
  "flight_review_date" date,
  "ipc_date" date,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "uniq_logbook_pro_settings_user" ON "logbook_pro_settings" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_logbook_pro_settings_user" ON "logbook_pro_settings" ("user_id");

CREATE TABLE IF NOT EXISTS "flight_plans" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" varchar NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "title" text NOT NULL,
  "departure" text NOT NULL,
  "destination" text NOT NULL,
  "route" text,
  "alternate" text,
  "planned_departure_at" timestamp,
  "planned_arrival_at" timestamp,
  "aircraft_type" text,
  "tail_number" text,
  "fuel_on_board" numeric(8,2),
  "fuel_required" numeric(8,2),
  "notes" text,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_flight_plans_user" ON "flight_plans" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_flight_plans_departure" ON "flight_plans" ("planned_departure_at");
