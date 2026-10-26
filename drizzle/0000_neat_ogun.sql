CREATE TYPE "public"."planner_item_kind" AS ENUM('target', 'habit', 'plan', 'chore', 'file', 'note');--> statement-breakpoint
CREATE TABLE "planner_areas" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(80) NOT NULL,
	"description" varchar(300) DEFAULT '' NOT NULL,
	"emoji" varchar(24) DEFAULT '🌱' NOT NULL,
	"color" varchar(20) DEFAULT 'mint' NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"area_id" uuid,
	"kind" "planner_item_kind" NOT NULL,
	"title" varchar(200) NOT NULL,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "planner_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	CONSTRAINT "planner_sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "planner_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"email" varchar(254) NOT NULL,
	"password_hash" text,
	"is_demo" boolean DEFAULT false NOT NULL,
	"timezone" varchar(80) DEFAULT 'UTC' NOT NULL,
	"daily_goal" integer DEFAULT 4 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "planner_users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "planner_areas" ADD CONSTRAINT "planner_areas_user_id_planner_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."planner_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_items" ADD CONSTRAINT "planner_items_user_id_planner_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."planner_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_items" ADD CONSTRAINT "planner_items_area_id_planner_areas_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."planner_areas"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "planner_sessions" ADD CONSTRAINT "planner_sessions_user_id_planner_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."planner_users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "planner_area_user_idx" ON "planner_areas" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "planner_item_user_idx" ON "planner_items" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "planner_item_area_idx" ON "planner_items" USING btree ("area_id");--> statement-breakpoint
CREATE INDEX "planner_session_user_idx" ON "planner_sessions" USING btree ("user_id");