CREATE TABLE IF NOT EXISTS "courtyard_group_room_blocks" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(),
  "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE,
  "group_name" text NOT NULL, "project_name" text,
  "arrival_date" date NOT NULL, "departure_date" date NOT NULL,
  "status" text NOT NULL DEFAULT 'prospect', "peak_rooms" integer, "total_room_nights" integer,
  "room_type_mix" text, "group_rate" numeric(12,2), "estimated_room_revenue" numeric(12,2),
  "booking_method" text, "cutoff_date" date, "group_code" text, "tax_exempt" boolean NOT NULL DEFAULT false,
  "primary_contact_name" text, "primary_contact_email" text, "primary_contact_phone" text, "sales_owner" text,
  "billing_instructions" text, "deposit_due_date" date, "deposit_amount" numeric(12,2),
  "arrival_notes" text, "vip_notes" text, "transportation_notes" text, "breakfast_notes" text,
  "front_desk_notes" text, "housekeeping_notes" text, "internal_notes" text,
  "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "updated_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_courtyard_group_room_blocks_dates" ON "courtyard_group_room_blocks"("hotel_id", "arrival_date", "departure_date");
CREATE INDEX IF NOT EXISTS "idx_courtyard_group_room_blocks_status" ON "courtyard_group_room_blocks"("status");
