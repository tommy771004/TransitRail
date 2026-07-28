CREATE TABLE IF NOT EXISTS "error_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"fingerprint" text NOT NULL,
	"occurrence_date" date NOT NULL,
	"severity" varchar(20) NOT NULL,
	"status" varchar(20) DEFAULT 'open' NOT NULL,
	"module" varchar(120) NOT NULL,
	"operation" varchar(160) NOT NULL,
	"error_code" varchar(160),
	"message" text NOT NULL,
	"stack" text,
	"country" varchar(80),
	"provider" varchar(200),
	"http_status" integer,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"first_context" jsonb,
	"last_context" jsonb,
	"first_occurred_at" timestamp with time zone NOT NULL,
	"last_occurred_at" timestamp with time zone NOT NULL,
	"resolved_at" timestamp with time zone,
	"resolution_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"category" varchar(100) NOT NULL,
	"content" text NOT NULL,
	"contact" varchar(255),
	"latitude" double precision,
	"longitude" double precision,
	"county" varchar(100),
	"district" varchar(100),
	"location_method" varchar(50),
	"created_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "push_subscriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh_key" text NOT NULL,
	"auth_key" text NOT NULL,
	"watched_routes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"language" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscriptions_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "TN_AUDIT_LOG" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" text,
	"transport_type" text NOT NULL,
	"origin_station_id" text,
	"origin_station_name" text,
	"dest_station_id" text,
	"dest_station_name" text,
	"query_date" date,
	"trip_type" text,
	"return_date" date,
	"active_filter" text,
	"result_count" integer,
	"language" text,
	"timezone" text,
	"device_type" text,
	"screen_width" integer,
	"screen_height" integer,
	"user_agent" text,
	"country_code" text,
	"region" text,
	"city" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"postal_code" text,
	"latitude" numeric(9, 6),
	"longitude" numeric(9, 6),
	"ip_timezone" text,
	"geo_latitude" double precision,
	"geo_longitude" double precision,
	"geo_accuracy" double precision
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "error_log_open_fingerprint_day_uq" ON "error_log" USING btree ("fingerprint","occurrence_date") WHERE "error_log"."status" = 'open';
