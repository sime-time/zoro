ALTER TABLE "goals" DROP CONSTRAINT "goals_source_message_id_messages_id_fkey";--> statement-breakpoint
ALTER TABLE "habit_events" DROP CONSTRAINT "habit_events_source_message_id_messages_id_fkey";--> statement-breakpoint
ALTER TABLE "habits" DROP CONSTRAINT "habits_source_message_id_messages_id_fkey";--> statement-breakpoint
ALTER TABLE "user_facts" DROP CONSTRAINT "user_facts_source_message_id_messages_id_fkey";--> statement-breakpoint
ALTER TABLE "goals" DROP COLUMN "source_message_id";--> statement-breakpoint
ALTER TABLE "habit_events" DROP COLUMN "source_message_id";--> statement-breakpoint
ALTER TABLE "habits" DROP COLUMN "source_message_id";--> statement-breakpoint
ALTER TABLE "user_facts" DROP COLUMN "source_message_id";