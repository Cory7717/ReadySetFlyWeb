ALTER TABLE "flight_plans"
ADD COLUMN IF NOT EXISTS "planner_state" jsonb;
