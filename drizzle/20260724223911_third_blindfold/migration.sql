ALTER TABLE "commitment_events" ALTER COLUMN "type" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "commitment_event_type";--> statement-breakpoint
CREATE TYPE "commitment_event_type" AS ENUM('created', 'updated', 'started', 'completed', 'missed', 'rescheduled', 'cancelled', 'reopened');--> statement-breakpoint
ALTER TABLE "commitment_events" ALTER COLUMN "type" SET DATA TYPE "commitment_event_type" USING "type"::"commitment_event_type";--> statement-breakpoint
ALTER TABLE "commitments" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "commitments" ALTER COLUMN "status" DROP DEFAULT;--> statement-breakpoint
DROP TYPE "commitment_status";--> statement-breakpoint
CREATE TYPE "commitment_status" AS ENUM('pending', 'in_progress', 'completed', 'missed', 'rescheduled', 'cancelled');--> statement-breakpoint
ALTER TABLE "commitments" ALTER COLUMN "status" SET DATA TYPE "commitment_status" USING "status"::"commitment_status";--> statement-breakpoint
ALTER TABLE "commitments" ALTER COLUMN "status" SET DEFAULT 'pending'::"commitment_status";