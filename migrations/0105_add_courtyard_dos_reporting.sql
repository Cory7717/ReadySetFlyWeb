CREATE TABLE IF NOT EXISTS "courtyard_hotels" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" text NOT NULL,
  "hotel_code" text NOT NULL,
  "brand" text,
  "market" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_courtyard_hotels_code"
  ON "courtyard_hotels" ("hotel_code");

CREATE INDEX IF NOT EXISTS "idx_courtyard_hotels_active"
  ON "courtyard_hotels" ("active");

INSERT INTO "courtyard_hotels" ("id", "name", "hotel_code", "brand", "market")
VALUES ('courtyard-austin-lakeline', 'Courtyard Austin Lakeline', 'AUSNL', 'Courtyard', 'Austin')
ON CONFLICT ("hotel_code") DO NOTHING;

CREATE TABLE IF NOT EXISTS "courtyard_hotel_user_access" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE,
  "user_id" varchar NOT NULL REFERENCES "tips_users"("id") ON DELETE CASCADE,
  "role" text NOT NULL DEFAULT 'dos',
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_courtyard_hotel_user"
  ON "courtyard_hotel_user_access" ("hotel_id", "user_id");

CREATE INDEX IF NOT EXISTS "idx_courtyard_hotel_access_user"
  ON "courtyard_hotel_user_access" ("user_id");

CREATE TABLE IF NOT EXISTS "courtyard_dos_reports" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE,
  "report_month" text NOT NULL,
  "status" text NOT NULL DEFAULT 'draft',
  "submitted_at" timestamp,
  "payload_json" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "updated_by" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_courtyard_dos_report_period"
  ON "courtyard_dos_reports" ("hotel_id", "report_month");

CREATE INDEX IF NOT EXISTS "idx_courtyard_dos_report_updated"
  ON "courtyard_dos_reports" ("updated_at");
