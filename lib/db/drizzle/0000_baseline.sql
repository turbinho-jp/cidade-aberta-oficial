CREATE TYPE "public"."activity_type" AS ENUM('demand_created', 'demand_resolved', 'comment_added', 'status_changed', 'service_order_created', 'confirmation_added');
--> statement-breakpoint
CREATE TYPE "public"."demand_priority" AS ENUM('low', 'medium', 'high', 'urgent');
--> statement-breakpoint
CREATE TYPE "public"."demand_status" AS ENUM('open', 'under_review', 'approved', 'in_progress', 'completed', 'rejected', 'closed');
--> statement-breakpoint
CREATE TYPE "public"."public_work_status" AS ENUM('planned', 'approved', 'in_progress', 'completed', 'suspended');
--> statement-breakpoint
CREATE TYPE "public"."service_order_priority" AS ENUM('low', 'medium', 'high', 'urgent');
--> statement-breakpoint
CREATE TYPE "public"."service_order_status" AS ENUM('pending', 'assigned', 'in_progress', 'completed', 'cancelled');
--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('citizen', 'admin', 'secretary', 'moderator');
--> statement-breakpoint
CREATE TABLE "activity_log" (
	"id" serial PRIMARY KEY NOT NULL,
	"type" "activity_type" NOT NULL,
	"description" text NOT NULL,
	"demand_id" integer,
	"demand_title" text,
	"actor_name" text,
	"neighborhood_name" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categories" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"icon" text DEFAULT 'AlertCircle' NOT NULL,
	"color" text DEFAULT '#3B82F6' NOT NULL,
	"description" text,
	"demands_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "comments" (
	"id" serial PRIMARY KEY NOT NULL,
	"demand_id" integer NOT NULL,
	"content" text NOT NULL,
	"author_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"author_avatar_url" text,
	"is_moderated" boolean DEFAULT false NOT NULL,
	"is_official" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "confirmations" (
	"id" serial PRIMARY KEY NOT NULL,
	"demand_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "demands" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "demand_status" DEFAULT 'open' NOT NULL,
	"priority" "demand_priority",
	"category_id" integer NOT NULL,
	"neighborhood_id" integer NOT NULL,
	"department_id" integer,
	"address" text NOT NULL,
	"lat" real NOT NULL,
	"lng" real NOT NULL,
	"photo_url" text,
	"confirmations_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"author_id" integer NOT NULL,
	"author_name" text NOT NULL,
	"public_response" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "departments" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '' NOT NULL,
	"logo_url" text,
	"demands_count" integer DEFAULT 0 NOT NULL,
	"resolved_count" integer DEFAULT 0 NOT NULL,
	"avg_resolution_days" real,
	"efficiency_index" real,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "neighborhoods" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"demands_count" integer DEFAULT 0 NOT NULL,
	"resolved_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "public_works" (
	"id" serial PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"status" "public_work_status" DEFAULT 'planned' NOT NULL,
	"neighborhood_id" integer NOT NULL,
	"department_id" integer,
	"investment" real,
	"start_date" timestamp,
	"estimated_end" timestamp,
	"completed_at" timestamp,
	"lat" real,
	"lng" real,
	"photo_url" text,
	"progress_percent" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "service_orders" (
	"id" serial PRIMARY KEY NOT NULL,
	"demand_id" integer NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"status" "service_order_status" DEFAULT 'pending' NOT NULL,
	"priority" "service_order_priority" DEFAULT 'medium' NOT NULL,
	"team_id" integer,
	"estimated_completion" timestamp,
	"completed_at" timestamp,
	"sla_hours" integer,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"area" text NOT NULL,
	"description" text,
	"active_orders_count" integer DEFAULT 0 NOT NULL,
	"completed_orders_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "timeline_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"demand_id" integer NOT NULL,
	"event" text NOT NULL,
	"description" text,
	"actor_name" text,
	"actor_role" text,
	"status_from" text,
	"status_to" text,
	"is_public" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'citizen' NOT NULL,
	"phone" text,
	"avatar_url" text,
	"points" integer DEFAULT 0 NOT NULL,
	"demands_count" integer DEFAULT 0 NOT NULL,
	"confirmations_count" integer DEFAULT 0 NOT NULL,
	"comments_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
