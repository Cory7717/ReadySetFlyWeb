ALTER TABLE "schedule_requests" ADD COLUMN IF NOT EXISTS "is_protected_leave" boolean NOT NULL DEFAULT false;
ALTER TABLE "schedule_requests" ADD COLUMN IF NOT EXISTS "policy_version" text;
ALTER TABLE "schedule_requests" ADD COLUMN IF NOT EXISTS "policy_accepted_at" timestamp;
ALTER TABLE "schedule_requests" ADD COLUMN IF NOT EXISTS "manager_override_reason" text;
ALTER TABLE "schedule_requests" ADD COLUMN IF NOT EXISTS "coverage_plan" text;

CREATE TABLE IF NOT EXISTS "schedule_coverage_requirements" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "department" text NOT NULL, "role" text NOT NULL,
  "start_time" time NOT NULL, "end_time" time NOT NULL, "minimum_associates" integer NOT NULL DEFAULT 1,
  "active" boolean NOT NULL DEFAULT true, "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_schedule_coverage_requirement" ON "schedule_coverage_requirements" ("department", "role", "start_time", "end_time");

CREATE TABLE IF NOT EXISTS "schedule_blackout_dates" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "blackout_date" date NOT NULL, "department" text,
  "label" text NOT NULL, "reason" text, "restriction" text NOT NULL DEFAULT 'enhanced_review',
  "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_schedule_blackout_date" ON "schedule_blackout_dates" ("blackout_date");

CREATE TABLE IF NOT EXISTS "schedule_holiday_assignments" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "holiday_date" date NOT NULL, "holiday_name" text NOT NULL,
  "employee_id" varchar NOT NULL REFERENCES "schedule_employees"("id") ON DELETE CASCADE, "worked" boolean NOT NULL DEFAULT true,
  "notes" text, "recorded_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "created_at" timestamp DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "uniq_schedule_holiday_employee" ON "schedule_holiday_assignments" ("holiday_date", "employee_id");
CREATE INDEX IF NOT EXISTS "idx_schedule_holiday_date" ON "schedule_holiday_assignments" ("holiday_date");

CREATE TABLE IF NOT EXISTS "schedule_shift_exchanges" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "requester_user_id" varchar NOT NULL REFERENCES "tips_users"("id") ON DELETE CASCADE,
  "replacement_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "shift_date" date NOT NULL,
  "start_time" time NOT NULL, "end_time" time NOT NULL, "department" text NOT NULL, "notes" text,
  "status" text NOT NULL DEFAULT 'proposed', "replacement_accepted_at" timestamp,
  "reviewed_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "reviewed_at" timestamp,
  "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_schedule_exchange_date" ON "schedule_shift_exchanges" ("shift_date");
CREATE INDEX IF NOT EXISTS "idx_schedule_exchange_status" ON "schedule_shift_exchanges" ("status");
