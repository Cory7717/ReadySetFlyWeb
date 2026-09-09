CREATE TABLE IF NOT EXISTS "bistro_food_waste_entries" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "entry_date" date NOT NULL,
  "food_item" text NOT NULL,
  "quantity" numeric(10, 2) NOT NULL,
  "unit" text,
  "reason" text NOT NULL,
  "total_cost" numeric(12, 2) NOT NULL,
  "notes" text,
  "recorded_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "updated_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now(),
  CONSTRAINT "bistro_food_waste_reason_check" CHECK ("reason" IN ('expired', 'spoiled', 'shift_meal')),
  CONSTRAINT "bistro_food_waste_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "bistro_food_waste_cost_check" CHECK ("total_cost" >= 0)
);

CREATE INDEX IF NOT EXISTS "idx_bistro_food_waste_date" ON "bistro_food_waste_entries" ("entry_date");
CREATE INDEX IF NOT EXISTS "idx_bistro_food_waste_reason" ON "bistro_food_waste_entries" ("reason");
