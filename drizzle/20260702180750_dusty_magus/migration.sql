ALTER TYPE "habit_event_type" RENAME TO "habit_event_status";--> statement-breakpoint
ALTER TABLE "habit_events" RENAME COLUMN "event_type" TO "status";