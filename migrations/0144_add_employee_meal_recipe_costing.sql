ALTER TABLE "bistro_food_waste_entries"
  ADD COLUMN IF NOT EXISTS "employee_meal_recipe_id" text;

ALTER TABLE "bistro_food_waste_entries"
  ADD COLUMN IF NOT EXISTS "recipe_cost_breakdown" jsonb;
