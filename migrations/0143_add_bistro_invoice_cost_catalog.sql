CREATE TABLE IF NOT EXISTS "bistro_food_cost_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "vendor" text NOT NULL,
  "vendor_item_number" text,
  "item_name" text NOT NULL,
  "pack_size" text,
  "costing_unit" text NOT NULL DEFAULT 'each',
  "units_per_pack" numeric(12, 4) NOT NULL DEFAULT 1,
  "pack_cost" numeric(12, 2) NOT NULL,
  "cost_per_unit" numeric(12, 4) NOT NULL,
  "invoice_number" text,
  "invoice_date" date,
  "source_file_name" text,
  "active" boolean NOT NULL DEFAULT true,
  "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_bistro_food_cost_item_name" ON "bistro_food_cost_items" ("item_name");
CREATE INDEX IF NOT EXISTS "idx_bistro_food_cost_vendor_sku" ON "bistro_food_cost_items" ("vendor", "vendor_item_number");

ALTER TABLE "bistro_food_waste_entries" ADD COLUMN IF NOT EXISTS "unit_cost" numeric(12, 4);
ALTER TABLE "bistro_food_waste_entries" ADD COLUMN IF NOT EXISTS "catalog_item_id" varchar;
DO $$ BEGIN
  ALTER TABLE "bistro_food_waste_entries"
    ADD CONSTRAINT "bistro_food_waste_catalog_item_id_fkey"
    FOREIGN KEY ("catalog_item_id") REFERENCES "bistro_food_cost_items"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
