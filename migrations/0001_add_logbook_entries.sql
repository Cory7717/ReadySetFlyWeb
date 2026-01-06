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

ALTER TABLE "logbook_entries" ADD CONSTRAINT "logbook_entries_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;

CREATE INDEX "idx_logbook_user" ON "logbook_entries" USING btree ("user_id");
CREATE INDEX "idx_logbook_date" ON "logbook_entries" USING btree ("flight_date");
