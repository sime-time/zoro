CREATE TYPE "commitment_event_type" AS ENUM('created', 'updated', 'started', 'completed', 'missed', 'blocked', 'rescheduled', 'cancelled', 'reopened');--> statement-breakpoint
CREATE TYPE "commitment_status" AS ENUM('pending', 'in_progress', 'completed', 'missed', 'blocked', 'rescheduled', 'cancelled');--> statement-breakpoint
CREATE TYPE "memory_importance" AS ENUM('low', 'normal', 'high');--> statement-breakpoint
CREATE TYPE "memory_type" AS ENUM('fact', 'preference', 'constraint', 'motivation', 'behavior_pattern', 'relationship', 'strategy');--> statement-breakpoint
CREATE TYPE "routine_target_period" AS ENUM('day', 'week', 'month');--> statement-breakpoint
CREATE TYPE "scheduled_message_status" AS ENUM('scheduled', 'processing', 'sent', 'cancelled', 'failed');--> statement-breakpoint
CREATE TYPE "scheduled_message_type" AS ENUM('reminder', 'check_in', 'follow_up');--> statement-breakpoint
CREATE TABLE "commitment_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"commitment_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"source_message_id" uuid,
	"type" "commitment_event_type" NOT NULL,
	"note" text,
	"metadata" jsonb,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commitments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"goal_id" uuid,
	"source_message_id" uuid,
	"title" text NOT NULL,
	"details" text,
	"motivation" text,
	"success_criteria" text,
	"status" "commitment_status" DEFAULT 'pending'::"commitment_status" NOT NULL,
	"due_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"routine_id" uuid,
	"routine_period_start" date,
	"routine_period_end" date,
	"routine_slot" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "memories" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"source_message_id" uuid,
	"type" "memory_type" NOT NULL,
	"subject" text NOT NULL,
	"content" text NOT NULL,
	"importance" "memory_importance" DEFAULT 'normal'::"memory_importance" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "routines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"goal_id" uuid,
	"title" text NOT NULL,
	"description" text,
	"target_count" integer DEFAULT 1 NOT NULL,
	"target_period" "routine_target_period" DEFAULT 'week'::"routine_target_period" NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "scheduled_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"commitment_id" uuid,
	"message_id" uuid,
	"type" "scheduled_message_type" NOT NULL,
	"scheduled_for" timestamp with time zone NOT NULL,
	"status" "scheduled_message_status" DEFAULT 'scheduled'::"scheduled_message_status" NOT NULL,
	"content" text,
	"sent_at" timestamp with time zone,
	"last_error" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habit_events" DROP CONSTRAINT "habit_events_habit_id_habits_id_fkey";--> statement-breakpoint
DROP TABLE "habit_events";--> statement-breakpoint
DROP TABLE "habits";--> statement-breakpoint
DROP TABLE "user_facts";--> statement-breakpoint
CREATE INDEX "commitment_events_commitment_idx" ON "commitment_events" ("commitment_id","occurred_at");--> statement-breakpoint
CREATE INDEX "commitment_events_user_idx" ON "commitment_events" ("user_id","occurred_at");--> statement-breakpoint
CREATE INDEX "commitments_user_status_idx" ON "commitments" ("user_id","status");--> statement-breakpoint
CREATE INDEX "commitments_due_idx" ON "commitments" ("status","due_at");--> statement-breakpoint
CREATE INDEX "commitments_goal_idx" ON "commitments" ("goal_id");--> statement-breakpoint
CREATE INDEX "commitments_routine_idx" ON "commitments" ("routine_id");--> statement-breakpoint
CREATE INDEX "commitments_thread_idx" ON "commitments" ("thread_id");--> statement-breakpoint
CREATE UNIQUE INDEX "commitments_routine_slot_idx" ON "commitments" ("routine_id","routine_period_start","routine_slot");--> statement-breakpoint
CREATE INDEX "routines_user_idx" ON "routines" ("user_id");--> statement-breakpoint
CREATE INDEX "routines_goal_idx" ON "routines" ("goal_id");--> statement-breakpoint
CREATE INDEX "routines_active_idx" ON "routines" ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "scheduled_messages_dispatch_idx" ON "scheduled_messages" ("status","scheduled_for");--> statement-breakpoint
CREATE INDEX "scheduled_messages_user_idx" ON "scheduled_messages" ("user_id","scheduled_for");--> statement-breakpoint
CREATE INDEX "scheduled_messages_commitment_idx" ON "scheduled_messages" ("commitment_id");--> statement-breakpoint
CREATE INDEX "scheduled_messages_thread_idx" ON "scheduled_messages" ("thread_id");--> statement-breakpoint
ALTER TABLE "commitment_events" ADD CONSTRAINT "commitment_events_commitment_id_commitments_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "commitment_events" ADD CONSTRAINT "commitment_events_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "commitment_events" ADD CONSTRAINT "commitment_events_source_message_id_messages_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_thread_id_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_goal_id_goals_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_source_message_id_messages_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "commitments" ADD CONSTRAINT "commitments_routine_id_routines_id_fkey" FOREIGN KEY ("routine_id") REFERENCES "routines"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "memories" ADD CONSTRAINT "memories_source_message_id_messages_id_fkey" FOREIGN KEY ("source_message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_goal_id_goals_id_fkey" FOREIGN KEY ("goal_id") REFERENCES "goals"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_thread_id_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_commitment_id_commitments_id_fkey" FOREIGN KEY ("commitment_id") REFERENCES "commitments"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_message_id_messages_id_fkey" FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE SET NULL;--> statement-breakpoint
DROP TYPE "habit_event_status";--> statement-breakpoint
DROP TYPE "habit_status";--> statement-breakpoint
DROP TYPE "habit_target_period";--> statement-breakpoint
DROP TYPE "weekdays";