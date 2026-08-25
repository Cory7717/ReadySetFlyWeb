CREATE TABLE IF NOT EXISTS "courtyard_sales_transitions" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "hotel_id" varchar NOT NULL REFERENCES "courtyard_hotels"("id") ON DELETE CASCADE,
  "title" text NOT NULL, "departure_date" date, "status" text NOT NULL DEFAULT 'in_progress', "departing_user_name" text, "summary" text,
  "departing_signed_at" timestamp, "manager_accepted_at" timestamp, "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_sales_transition_hotel" ON "courtyard_sales_transitions"("hotel_id");
CREATE TABLE IF NOT EXISTS "courtyard_sales_transition_items" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "transition_id" varchar NOT NULL REFERENCES "courtyard_sales_transitions"("id") ON DELETE CASCADE,
  "category" text NOT NULL, "title" text NOT NULL, "description" text, "status" text NOT NULL DEFAULT 'not_started', "due_date" date, "owner_name" text,
  "url" text, "username" text, "vault_url" text, "mfa_owner" text, "recovery_contact" text, "account_key" text,
  "opportunity_id" varchar REFERENCES "courtyard_sales_opportunities"("id") ON DELETE SET NULL, "frequency" text,
  "confidential" boolean NOT NULL DEFAULT false, "metadata_json" jsonb, "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now(), "updated_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_sales_transition_items_transition" ON "courtyard_sales_transition_items"("transition_id");
CREATE INDEX IF NOT EXISTS "idx_sales_transition_items_category" ON "courtyard_sales_transition_items"("category");
CREATE TABLE IF NOT EXISTS "courtyard_sales_transition_documents" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "transition_id" varchar NOT NULL REFERENCES "courtyard_sales_transitions"("id") ON DELETE CASCADE,
  "filename" text NOT NULL, "mime_type" text NOT NULL, "size_bytes" integer NOT NULL, "category" text NOT NULL DEFAULT 'other', "description" text,
  "confidential" boolean NOT NULL DEFAULT false, "content_base64" text NOT NULL, "uploaded_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL,
  "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_sales_transition_documents_transition" ON "courtyard_sales_transition_documents"("transition_id");
CREATE TABLE IF NOT EXISTS "courtyard_sales_transition_shares" (
  "id" varchar PRIMARY KEY DEFAULT gen_random_uuid(), "transition_id" varchar NOT NULL REFERENCES "courtyard_sales_transitions"("id") ON DELETE CASCADE,
  "token_hash" text NOT NULL UNIQUE, "recipient_name" text, "recipient_email" text, "expires_at" timestamp NOT NULL,
  "allow_downloads" boolean NOT NULL DEFAULT false, "revoked_at" timestamp, "last_accessed_at" timestamp, "access_count" integer NOT NULL DEFAULT 0,
  "created_by_user_id" varchar REFERENCES "tips_users"("id") ON DELETE SET NULL, "created_at" timestamp DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_sales_transition_shares_transition" ON "courtyard_sales_transition_shares"("transition_id");
