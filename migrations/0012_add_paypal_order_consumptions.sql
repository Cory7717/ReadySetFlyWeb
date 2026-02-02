CREATE TABLE IF NOT EXISTS "paypal_order_consumptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "order_id" text NOT NULL,
  "user_id" varchar NOT NULL REFERENCES "users"("id"),
  "purpose" text NOT NULL,
  "resource_type" text,
  "resource_id" text,
  "amount" numeric(10, 2) NOT NULL,
  "currency" text DEFAULT 'USD',
  "status" text DEFAULT 'consumed',
  "created_at" timestamp DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS "idx_paypal_order_consumptions_order"
  ON "paypal_order_consumptions" ("order_id");

CREATE INDEX IF NOT EXISTS "idx_paypal_order_consumptions_user"
  ON "paypal_order_consumptions" ("user_id");
