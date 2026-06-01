CREATE TABLE IF NOT EXISTS "vehicle_listings" (
  "id" varchar PRIMARY KEY NOT NULL,
  "title" text NOT NULL,
  "year" integer NOT NULL,
  "make" text NOT NULL,
  "model" text NOT NULL,
  "trim" text,
  "body_style" text,
  "windshield_type" text,
  "transmission" text,
  "mileage" text,
  "vin" text,
  "vin_public" boolean DEFAULT false NOT NULL,
  "location" text,
  "asking_price" numeric(12, 2),
  "price_type" text DEFAULT 'accepting_offers' NOT NULL,
  "status" text DEFAULT 'available' NOT NULL,
  "story" text,
  "description" text,
  "condition_summary" text,
  "known_issues" text,
  "specs_json" jsonb,
  "market_value_ranges_json" jsonb,
  "ai_valuation_json" jsonb,
  "photos_json" jsonb,
  "hero_photo_url" text,
  "seller_contact_json" jsonb,
  "ai_listing_drafts_json" jsonb,
  "created_at" timestamp DEFAULT now(),
  "updated_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_vehicle_listings_status" ON "vehicle_listings" ("status");

CREATE TABLE IF NOT EXISTS "vehicle_listing_leads" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "listing_id" varchar NOT NULL REFERENCES "vehicle_listings"("id") ON DELETE cascade,
  "name" text NOT NULL,
  "email" text NOT NULL,
  "phone" text,
  "message" text,
  "interest_type" text DEFAULT 'general_inquiry' NOT NULL,
  "offer_amount" numeric(12, 2),
  "preferred_contact_method" text,
  "status" text DEFAULT 'new' NOT NULL,
  "created_at" timestamp DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "idx_vehicle_listing_leads_listing" ON "vehicle_listing_leads" ("listing_id");
CREATE INDEX IF NOT EXISTS "idx_vehicle_listing_leads_created" ON "vehicle_listing_leads" ("created_at");
