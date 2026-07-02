CREATE TYPE "weekdays" AS ENUM('sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday');--> statement-breakpoint
ALTER TABLE "habits" ADD COLUMN "scheduled_days" "weekdays"[];