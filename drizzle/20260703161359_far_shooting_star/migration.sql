DROP INDEX "meals_log_date_idx";--> statement-breakpoint
CREATE INDEX "meals_user_log_date_idx" ON "meals" ("user_id","log_date");