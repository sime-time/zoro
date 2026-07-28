CREATE TYPE "reminder_frequency" AS ENUM('once', 'daily', 'weekly', 'monthly');--> statement-breakpoint
CREATE TYPE "reminder_status" AS ENUM('active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "weekday_name" AS ENUM('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday');--> statement-breakpoint
CREATE TABLE "reminders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"title" text NOT NULL,
	"details" text,
	"status" "reminder_status" DEFAULT 'active'::"reminder_status" NOT NULL,
	"frequency" "reminder_frequency" DEFAULT 'once'::"reminder_frequency" NOT NULL,
	"local_time" text,
	"interval" integer,
	"weekdays" "weekday_name"[],
	"day_of_month" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "scheduled_messages" DROP CONSTRAINT "scheduled_messages_commitment_id_commitments_id_fkey";--> statement-breakpoint
ALTER TABLE "commitment_events" DROP CONSTRAINT "commitment_events_commitment_id_commitments_id_fkey";--> statement-breakpoint
ALTER TABLE "commitments" DROP CONSTRAINT "commitments_goal_id_goals_id_fkey";--> statement-breakpoint
ALTER TABLE "commitments" DROP CONSTRAINT "commitments_routine_id_routines_id_fkey";--> statement-breakpoint
ALTER TABLE "routines" DROP CONSTRAINT "routines_goal_id_goals_id_fkey";--> statement-breakpoint
DROP TABLE "commitment_events";--> statement-breakpoint
DROP TABLE "commitments";--> statement-breakpoint
DROP TABLE "goals";--> statement-breakpoint
DROP TABLE "meals";--> statement-breakpoint
DROP TABLE "routines";--> statement-breakpoint
DROP INDEX "scheduled_messages_commitment_idx";--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD COLUMN "reminder_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "scheduled_messages" DROP COLUMN "commitment_id";--> statement-breakpoint
ALTER TABLE "scheduled_messages" DROP COLUMN "type";--> statement-breakpoint
CREATE INDEX "reminders_user_status_idx" ON "reminders" ("user_id","status");--> statement-breakpoint
CREATE INDEX "reminders_thread_idx" ON "reminders" ("thread_id");--> statement-breakpoint
CREATE INDEX "scheduled_messages_reminder_idx" ON "scheduled_messages" ("reminder_id");--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_thread_id_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "scheduled_messages" ADD CONSTRAINT "scheduled_messages_reminder_id_reminders_id_fkey" FOREIGN KEY ("reminder_id") REFERENCES "reminders"("id") ON DELETE CASCADE;--> statement-breakpoint
DROP TYPE "commitment_event_type";--> statement-breakpoint
DROP TYPE "commitment_status";--> statement-breakpoint
DROP TYPE "goal_status";--> statement-breakpoint
DROP TYPE "routine_target_period";--> statement-breakpoint
DROP TYPE "scheduled_message_type";