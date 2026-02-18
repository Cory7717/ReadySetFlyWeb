CREATE TABLE IF NOT EXISTS "hk_daily_metrics" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "metric_date" date NOT NULL,
  "property" text NOT NULL,
  "occupied_rooms" integer DEFAULT 0,
  "checkouts" integer DEFAULT 0,
  "stayovers" integer DEFAULT 0,
  "rooms_cleaned" integer DEFAULT 0,
  "paid_hours" numeric(6,2) DEFAULT '0.00',
  "lunch_minutes" integer DEFAULT 0,
  "productive_hours" numeric(6,2) DEFAULT '0.00',
  "attendants_working" integer DEFAULT 0,
  "late_checkouts" integer DEFAULT 0,
  "inspections" integer DEFAULT 0,
  "recleans" integer DEFAULT 0,
  "dnd_rooms" integer DEFAULT 0,
  "ooo_rooms" integer DEFAULT 0,
  "notes" text,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_hk_daily_unique" ON "hk_daily_metrics" ("metric_date", "property");
CREATE INDEX IF NOT EXISTS "idx_hk_daily_date" ON "hk_daily_metrics" ("metric_date");
CREATE INDEX IF NOT EXISTS "idx_hk_daily_property" ON "hk_daily_metrics" ("property");

CREATE TABLE IF NOT EXISTS "hk_attendant_metrics" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "metric_date" date NOT NULL,
  "property" text NOT NULL,
  "attendant_name" text NOT NULL,
  "checkouts_cleaned" integer DEFAULT 0,
  "stayovers_cleaned" integer DEFAULT 0,
  "rooms_cleaned" integer DEFAULT 0,
  "paid_hours" numeric(6,2) DEFAULT '0.00',
  "lunch_minutes" integer DEFAULT 0,
  "productive_hours" numeric(6,2) DEFAULT '0.00',
  "deep_cleans" integer DEFAULT 0,
  "recleans" integer DEFAULT 0,
  "inspections" integer DEFAULT 0,
  "late_checkouts" integer DEFAULT 0,
  "notes" text,
  "created_by" varchar REFERENCES "users"("id"),
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_hk_attendant_unique" ON "hk_attendant_metrics" ("metric_date", "property", "attendant_name");
CREATE INDEX IF NOT EXISTS "idx_hk_attendant_date" ON "hk_attendant_metrics" ("metric_date");
CREATE INDEX IF NOT EXISTS "idx_hk_attendant_property" ON "hk_attendant_metrics" ("property");
CREATE INDEX IF NOT EXISTS "idx_hk_attendant_name" ON "hk_attendant_metrics" ("attendant_name");
