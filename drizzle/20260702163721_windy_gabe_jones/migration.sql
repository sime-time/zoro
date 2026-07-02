CREATE TYPE "goal_status" AS ENUM('active', 'paused', 'completed', 'archived');--> statement-breakpoint
CREATE TYPE "habit_event_type" AS ENUM('completed', 'skipped');--> statement-breakpoint
CREATE TYPE "habit_status" AS ENUM('active', 'paused', 'archived');--> statement-breakpoint
CREATE TYPE "habit_target_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"motivation" text,
	"success_criteria" text,
	"status" "goal_status" DEFAULT 'active'::"goal_status" NOT NULL,
	"deadline" date,
	"source_message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"habit_id" uuid NOT NULL,
	"event_type" "habit_event_type" NOT NULL,
	"occurred_on" date NOT NULL,
	"note" text,
	"source_message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"target_count" integer DEFAULT 1 NOT NULL,
	"target_period" "habit_target_period" DEFAULT 'day'::"habit_target_period" NOT NULL,
	"status" "habit_status" DEFAULT 'active'::"habit_status" NOT NULL,
	"source_message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_facts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"confidence" real DEFAULT 1 NOT NULL,
	"source_message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "goals_user_idx" ON "goals" ("user_id");--> statement-breakpoint
CREATE INDEX "goals_user_status_idx" ON "goals" ("user_id","status");--> statement-breakpoint
CREATE INDEX "habit_events_user_idx" ON "habit_events" ("user_id");--> statement-breakpoint
CREATE INDEX "habit_events_habit_date_idx" ON "habit_events" ("habit_id","occurred_on");--> statement-breakpoint
CREATE INDEX "habit_events_user_date_idx" ON "habit_events" ("user_id","occurred_on");--> statement-breakpoint
CREATE INDEX "habit_user_idx" ON "habits" ("user_id");--> statement-breakpoint
CREATE INDEX "habit_user_status_idx" ON "habits" ("user_id","status");--> statement-breakpoint
CREATE INDEX "user_facts_user_idx" ON "user_facts" ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_facts_user_key_idx" ON "user_facts" ("user_id","key");--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_source_message_id_messages_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "habit_events" ADD CONSTRAINT "habit_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "habit_events" ADD CONSTRAINT "habit_events_habit_id_habits_id_fkey" FOREIGN KEY ("habit_id") REFERENCES "habits"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "habit_events" ADD CONSTRAINT "habit_events_source_message_id_messages_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "habits" ADD CONSTRAINT "habits_source_message_id_messages_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "user_facts" ADD CONSTRAINT "user_facts_source_message_id_messages_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;