CREATE TABLE "admin_notifications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"category" text,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"is_actionable" boolean DEFAULT true,
	"listing_count" integer,
	"threshold" integer,
	"created_at" timestamp DEFAULT now(),
	"read_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "aircraft_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"owner_id" varchar NOT NULL,
	"make" text NOT NULL,
	"model" text NOT NULL,
	"year" integer NOT NULL,
	"registration" text NOT NULL,
	"category" text NOT NULL,
	"total_time" integer NOT NULL,
	"engine" text,
	"avionics_suite" text,
	"required_certifications" text[] NOT NULL,
	"min_flight_hours" integer DEFAULT 0,
	"hourly_rate" numeric(10, 2) NOT NULL,
	"insurance_included" boolean DEFAULT true,
	"wet_rate" boolean DEFAULT true,
	"images" text[] NOT NULL,
	"location" text NOT NULL,
	"city" text,
	"state" text,
	"zip_code" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"airport_code" text,
	"engine_type" text,
	"engine_count" integer,
	"seating_capacity" integer,
	"description" text,
	"is_listed" boolean DEFAULT true,
	"admin_notes" text,
	"is_featured" boolean DEFAULT false,
	"response_time_hours" integer DEFAULT 24,
	"acceptance_rate" integer DEFAULT 100,
	"serial_number" text,
	"registration_doc_url" text,
	"llc_authorization_url" text,
	"ownership_verified" boolean DEFAULT false,
	"ownership_verified_at" timestamp,
	"registry_checked_at" timestamp,
	"owner_name_match" boolean,
	"annual_inspection_doc_url" text,
	"annual_inspection_date" text,
	"annual_due_date" text,
	"annual_signer_name" text,
	"annual_signer_cert_number" text,
	"annual_signer_ia_number" text,
	"annual_ap_verified" boolean DEFAULT false,
	"requires_100_hour" boolean DEFAULT false,
	"hour_100_inspection_doc_url" text,
	"hour_100_inspection_tach" integer,
	"current_tach" integer,
	"hour_100_remaining" integer,
	"maintenance_tracking_provider" text,
	"maintenance_tracking_doc_url" text,
	"has_maintenance_tracking" boolean DEFAULT false,
	"maintenance_verified" boolean DEFAULT false,
	"maintenance_verified_at" timestamp,
	"last_refreshed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "banner_ad_orders" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"sponsor_name" text NOT NULL,
	"sponsor_email" text NOT NULL,
	"sponsor_company" text,
	"title" text NOT NULL,
	"description" text,
	"image_url" text,
	"link" text NOT NULL,
	"placements" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"category" text,
	"tier" text NOT NULL,
	"monthly_rate" numeric(10, 2) NOT NULL,
	"total_amount" numeric(10, 2) NOT NULL,
	"creation_fee" numeric(10, 2) DEFAULT '40.00',
	"grand_total" numeric(10, 2) NOT NULL,
	"promo_code" text,
	"discount_amount" numeric(10, 2) DEFAULT '0.00',
	"approval_status" text DEFAULT 'draft' NOT NULL,
	"payment_status" text DEFAULT 'pending' NOT NULL,
	"paypal_order_id" text,
	"paypal_payment_date" timestamp,
	"start_date" timestamp,
	"end_date" timestamp,
	"expiration_reminder_sent" boolean DEFAULT false,
	"expiration_reminder_sent_at" timestamp,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "banner_ads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" varchar,
	"title" text NOT NULL,
	"description" text,
	"image_url" text NOT NULL,
	"link" text NOT NULL,
	"placements" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"category" text,
	"listing_id" varchar,
	"listing_type" text,
	"is_active" boolean DEFAULT true,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp,
	"impressions" integer DEFAULT 0,
	"clicks" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "contact_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"email_sent" boolean DEFAULT false,
	"email_sent_at" timestamp,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_activities" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"type" text NOT NULL,
	"subject" text NOT NULL,
	"description" text,
	"lead_id" varchar,
	"contact_id" varchar,
	"deal_id" varchar,
	"created_by" varchar NOT NULL,
	"assigned_to" varchar,
	"due_date" timestamp,
	"completed_at" timestamp,
	"is_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_contacts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" varchar NOT NULL,
	"phone" text,
	"company" text,
	"title" text,
	"user_id" varchar,
	"assigned_to" varchar,
	"notes" text,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_deals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"stage" text DEFAULT 'lead' NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"probability" integer DEFAULT 50,
	"contact_id" varchar,
	"assigned_to" varchar,
	"expected_close_date" timestamp,
	"closed_date" timestamp,
	"description" text,
	"notes" text,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "crm_leads" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" varchar NOT NULL,
	"phone" text,
	"company" text,
	"title" text,
	"status" text DEFAULT 'new' NOT NULL,
	"source" text,
	"value" numeric(10, 2),
	"assigned_to" varchar,
	"notes" text,
	"tags" text[] DEFAULT ARRAY[]::text[],
	"converted_to_contact_id" varchar,
	"converted_to_deal_id" varchar,
	"converted_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "expenses" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"category" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text,
	"invoice_url" text,
	"expense_date" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "favorites" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"listing_type" text NOT NULL,
	"listing_id" varchar NOT NULL,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "job_applications" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"applicant_id" varchar,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"email" text NOT NULL,
	"phone" text,
	"current_job_title" text,
	"years_of_experience" text,
	"cover_letter" text,
	"resume_url" text NOT NULL,
	"status" text DEFAULT 'new' NOT NULL,
	"employer_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "logbook_entries" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"flight_date" date NOT NULL,
	"tail_number" text,
	"aircraft_type" text,
	"route" text,
	"time_day" numeric(6, 2) DEFAULT 0 NOT NULL,
	"time_night" numeric(6, 2) DEFAULT 0 NOT NULL,
	"pic" numeric(6, 2) DEFAULT 0 NOT NULL,
	"sic" numeric(6, 2) DEFAULT 0 NOT NULL,
	"dual" numeric(6, 2) DEFAULT 0 NOT NULL,
	"instrument_actual" numeric(6, 2) DEFAULT 0 NOT NULL,
	"approaches" integer DEFAULT 0 NOT NULL,
	"landings_day" integer DEFAULT 0 NOT NULL,
	"landings_night" integer DEFAULT 0 NOT NULL,
	"holds" integer DEFAULT 0 NOT NULL,
	"remarks" text,
	"maneuvers" jsonb,
	"hobbs_start" numeric(8, 1),
	"hobbs_end" numeric(8, 1),
	"signature_data_url" text,
	"signed_by_name" text,
	"signed_at" timestamp,
	"is_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_flags" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" varchar NOT NULL,
	"user_id" varchar NOT NULL,
	"reason" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "marketplace_listings" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"category" text NOT NULL,
	"tier" text,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"images" text[] DEFAULT ARRAY[]::text[],
	"location" text,
	"city" text,
	"state" text,
	"zip_code" text,
	"latitude" numeric(10, 7),
	"longitude" numeric(10, 7),
	"contact_email" text,
	"contact_phone" text,
	"details" jsonb,
	"price" numeric(12, 2),
	"is_active" boolean DEFAULT true,
	"expires_at" timestamp,
	"expiration_reminder_sent" boolean DEFAULT false,
	"expiration_reminder_sent_at" timestamp,
	"admin_notes" text,
	"is_featured" boolean DEFAULT false,
	"is_example" boolean DEFAULT false,
	"flag_count" integer DEFAULT 0 NOT NULL,
	"view_count" integer DEFAULT 0 NOT NULL,
	"is_paid" boolean DEFAULT false,
	"monthly_fee" numeric(10, 2),
	"upgrade_transactions" text[] DEFAULT ARRAY[]::text[],
	"promo_free_until" timestamp,
	"promo_granted_by" varchar,
	"promo_granted_at" timestamp,
	"last_refreshed_at" timestamp DEFAULT now(),
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" varchar NOT NULL,
	"sender_id" varchar NOT NULL,
	"receiver_id" varchar NOT NULL,
	"content" text NOT NULL,
	"is_read" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "oauth_exchange_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"token" text NOT NULL,
	"user_id" varchar NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	CONSTRAINT "oauth_exchange_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "promo_alerts" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" text NOT NULL,
	"message" text NOT NULL,
	"promo_code" text,
	"is_enabled" boolean DEFAULT true,
	"show_on_main_page" boolean DEFAULT true,
	"show_on_category_pages" boolean DEFAULT true,
	"target_categories" text[] DEFAULT ARRAY[]::text[],
	"variant" text DEFAULT 'info',
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_code_usages" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"promo_code_id" varchar NOT NULL,
	"user_id" varchar,
	"marketplace_listing_id" varchar,
	"banner_ad_order_id" varchar,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "promo_codes" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"discount_type" text NOT NULL,
	"discount_value" numeric(10, 2),
	"max_uses" integer,
	"used_count" integer DEFAULT 0,
	"is_active" boolean DEFAULT true,
	"valid_from" timestamp DEFAULT now(),
	"valid_until" timestamp,
	"applicable_to_marketplace" boolean DEFAULT true,
	"applicable_to_banner_ads" boolean DEFAULT false,
	"applicable_categories" text[] DEFAULT ARRAY[]::text[],
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "promo_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now(),
	"device_info" text,
	"ip_address" text,
	CONSTRAINT "refresh_tokens_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "rentals" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"aircraft_id" varchar NOT NULL,
	"renter_id" varchar NOT NULL,
	"owner_id" varchar NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"estimated_hours" numeric(6, 2) NOT NULL,
	"actual_hours" numeric(6, 2),
	"hourly_rate" numeric(10, 2) NOT NULL,
	"base_cost" numeric(10, 2) NOT NULL,
	"sales_tax" numeric(10, 2) NOT NULL,
	"platform_fee_renter" numeric(10, 2) NOT NULL,
	"platform_fee_owner" numeric(10, 2) NOT NULL,
	"processing_fee" numeric(10, 2) NOT NULL,
	"total_cost_renter" numeric(10, 2) NOT NULL,
	"owner_payout" numeric(10, 2) NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"is_paid" boolean DEFAULT false,
	"payout_completed" boolean DEFAULT false,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "reviews" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rental_id" varchar NOT NULL,
	"reviewer_id" varchar NOT NULL,
	"reviewee_id" varchar NOT NULL,
	"rating" integer NOT NULL,
	"comment" text,
	"communication_rating" integer,
	"cleanliness_rating" integer,
	"accuracy_rating" integer,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"sid" varchar PRIMARY KEY NOT NULL,
	"sess" jsonb NOT NULL,
	"expire" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "transactions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"rental_id" varchar,
	"marketplace_listing_id" varchar,
	"status" text DEFAULT 'pending' NOT NULL,
	"deposited_to_bank_at" timestamp,
	"description" text,
	"created_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar,
	"first_name" varchar,
	"last_name" varchar,
	"profile_image_url" varchar,
	"phone" text,
	"certifications" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"total_flight_hours" integer DEFAULT 0,
	"aircraft_types_flown" text[] DEFAULT ARRAY[]::text[],
	"pilot_license_url" text,
	"insurance_url" text,
	"is_verified" boolean DEFAULT false,
	"license_verified" boolean DEFAULT false,
	"background_check_completed" boolean DEFAULT false,
	"is_admin" boolean DEFAULT false,
	"is_super_admin" boolean DEFAULT false,
	"legal_first_name" text,
	"legal_last_name" text,
	"date_of_birth" text,
	"phone_verified" boolean DEFAULT false,
	"email_verified" boolean DEFAULT false,
	"government_id_front_url" text,
	"government_id_back_url" text,
	"selfie_url" text,
	"identity_verified" boolean DEFAULT false,
	"identity_verified_at" timestamp,
	"payment_method_on_file" boolean DEFAULT false,
	"payment_verified" boolean DEFAULT false,
	"payment_verified_at" timestamp,
	"faa_certificate_number" text,
	"pilot_certificate_name" text,
	"pilot_certificate_photo_url" text,
	"faa_verified" boolean DEFAULT false,
	"faa_verified_month" text,
	"faa_verified_at" timestamp,
	"bank_account_connected" boolean DEFAULT false,
	"stripe_account_id" text,
	"paypal_email" text,
	"balance" numeric(10, 2) DEFAULT '0.00',
	"hashed_password" text,
	"password_created_at" timestamp,
	"email_verification_token" text,
	"email_verification_expires" timestamp,
	"average_rating" numeric(3, 2),
	"total_reviews" integer DEFAULT 0,
	"is_suspended" boolean DEFAULT false,
	"suspension_reason" text,
	"suspended_at" timestamp,
	"suspended_by" varchar,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now(),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification_submissions" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"type" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"aircraft_id" varchar,
	"submission_data" jsonb NOT NULL,
	"document_urls" text[] DEFAULT ARRAY[]::text[],
	"reviewed_by" varchar,
	"reviewed_at" timestamp,
	"review_notes" text,
	"rejection_reason" text,
	"faa_registry_checked" boolean DEFAULT false,
	"faa_registry_match" boolean,
	"faa_registry_data" jsonb,
	"sources" text[] DEFAULT ARRAY[]::text[],
	"file_hashes" text[] DEFAULT ARRAY[]::text[],
	"pilot_license_expires_at" timestamp,
	"medical_cert_expires_at" timestamp,
	"insurance_expires_at" timestamp,
	"government_id_expires_at" timestamp,
	"expiration_notification_sent" boolean DEFAULT false,
	"last_notification_sent_at" timestamp,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE "withdrawal_requests" (
	"id" varchar PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"paypal_email" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payout_batch_id" text,
	"payout_item_id" text,
	"transaction_id" text,
	"processed_at" timestamp,
	"processed_by" varchar,
	"failure_reason" text,
	"admin_notes" text,
	"created_at" timestamp DEFAULT now(),
	"updated_at" timestamp DEFAULT now()
);
--> statement-breakpoint
ALTER TABLE "aircraft_listings" ADD CONSTRAINT "aircraft_listings_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "banner_ads" ADD CONSTRAINT "banner_ads_order_id_banner_ad_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."banner_ad_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_lead_id_crm_leads_id_fk" FOREIGN KEY ("lead_id") REFERENCES "public"."crm_leads"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_deal_id_crm_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."crm_deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_activities" ADD CONSTRAINT "crm_activities_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_contacts" ADD CONSTRAINT "crm_contacts_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_contact_id_crm_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."crm_contacts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_deals" ADD CONSTRAINT "crm_deals_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "crm_leads" ADD CONSTRAINT "crm_leads_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "favorites" ADD CONSTRAINT "favorites_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_applications" ADD CONSTRAINT "job_applications_applicant_id_users_id_fk" FOREIGN KEY ("applicant_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_flags" ADD CONSTRAINT "marketplace_flags_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_flags" ADD CONSTRAINT "marketplace_flags_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_listings" ADD CONSTRAINT "marketplace_listings_promo_granted_by_users_id_fk" FOREIGN KEY ("promo_granted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_receiver_id_users_id_fk" FOREIGN KEY ("receiver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "oauth_exchange_tokens" ADD CONSTRAINT "oauth_exchange_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_promo_code_id_promo_codes_id_fk" FOREIGN KEY ("promo_code_id") REFERENCES "public"."promo_codes"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_marketplace_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("marketplace_listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "promo_code_usages" ADD CONSTRAINT "promo_code_usages_banner_ad_order_id_banner_ad_orders_id_fk" FOREIGN KEY ("banner_ad_order_id") REFERENCES "public"."banner_ad_orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_aircraft_id_aircraft_listings_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_renter_id_users_id_fk" FOREIGN KEY ("renter_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rentals" ADD CONSTRAINT "rentals_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewer_id_users_id_fk" FOREIGN KEY ("reviewer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_reviewee_id_users_id_fk" FOREIGN KEY ("reviewee_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_rental_id_rentals_id_fk" FOREIGN KEY ("rental_id") REFERENCES "public"."rentals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_marketplace_listing_id_marketplace_listings_id_fk" FOREIGN KEY ("marketplace_listing_id") REFERENCES "public"."marketplace_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_suspended_by_users_id_fk" FOREIGN KEY ("suspended_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_aircraft_id_aircraft_listings_id_fk" FOREIGN KEY ("aircraft_id") REFERENCES "public"."aircraft_listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "verification_submissions" ADD CONSTRAINT "verification_submissions_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "withdrawal_requests" ADD CONSTRAINT "withdrawal_requests_processed_by_users_id_fk" FOREIGN KEY ("processed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_aircraft_city" ON "aircraft_listings" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_aircraft_is_listed" ON "aircraft_listings" USING btree ("is_listed");--> statement-breakpoint
CREATE INDEX "idx_aircraft_category" ON "aircraft_listings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_aircraft_engine_type" ON "aircraft_listings" USING btree ("engine_type");--> statement-breakpoint
CREATE INDEX "idx_aircraft_city_engine_type" ON "aircraft_listings" USING btree ("city","engine_type");--> statement-breakpoint
CREATE INDEX "idx_aircraft_category_city" ON "aircraft_listings" USING btree ("category","city");--> statement-breakpoint
CREATE INDEX "idx_banner_orders_status" ON "banner_ad_orders" USING btree ("approval_status","payment_status");--> statement-breakpoint
CREATE INDEX "idx_banner_orders_email" ON "banner_ad_orders" USING btree ("sponsor_email");--> statement-breakpoint
CREATE INDEX "idx_banner_ads_placements" ON "banner_ads" USING btree ("placements");--> statement-breakpoint
CREATE INDEX "idx_banner_ads_active" ON "banner_ads" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_banner_ads_dates" ON "banner_ads" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "idx_banner_ads_order" ON "banner_ads" USING btree ("order_id");--> statement-breakpoint
CREATE INDEX "idx_contact_email" ON "contact_submissions" USING btree ("email");--> statement-breakpoint
CREATE INDEX "idx_contact_created" ON "contact_submissions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "idx_contact_ip" ON "contact_submissions" USING btree ("ip_address");--> statement-breakpoint
CREATE INDEX "idx_favorites_user" ON "favorites" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_favorites_listing" ON "favorites" USING btree ("listing_type","listing_id");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_favorites_user_listing_unique" ON "favorites" USING btree ("user_id","listing_type","listing_id");--> statement-breakpoint
CREATE INDEX "idx_job_applications_listing" ON "job_applications" USING btree ("listing_id");--> statement-breakpoint
CREATE INDEX "idx_job_applications_applicant" ON "job_applications" USING btree ("applicant_id");--> statement-breakpoint
CREATE INDEX "idx_job_applications_status" ON "job_applications" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_logbook_user" ON "logbook_entries" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_logbook_date" ON "logbook_entries" USING btree ("flight_date");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_marketplace_flags_unique" ON "marketplace_flags" USING btree ("listing_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_category" ON "marketplace_listings" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_marketplace_city" ON "marketplace_listings" USING btree ("city");--> statement-breakpoint
CREATE INDEX "idx_marketplace_is_active" ON "marketplace_listings" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "idx_marketplace_category_city" ON "marketplace_listings" USING btree ("category","city");--> statement-breakpoint
CREATE INDEX "idx_marketplace_category_active" ON "marketplace_listings" USING btree ("category","is_active");--> statement-breakpoint
CREATE INDEX "idx_marketplace_flag_count" ON "marketplace_listings" USING btree ("flag_count");--> statement-breakpoint
CREATE INDEX "idx_oauth_exchange_tokens_token" ON "oauth_exchange_tokens" USING btree ("token");--> statement-breakpoint
CREATE INDEX "idx_oauth_exchange_tokens_expires" ON "oauth_exchange_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_user" ON "refresh_tokens" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_refresh_tokens_expires" ON "refresh_tokens" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "IDX_session_expire" ON "sessions" USING btree ("expire");--> statement-breakpoint
CREATE INDEX "idx_withdrawal_user" ON "withdrawal_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_withdrawal_status" ON "withdrawal_requests" USING btree ("status");