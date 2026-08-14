DROP INDEX "composio_sessions_user_thread_active_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "composio_sessions_user_thread_idx" ON "composio_sessions" ("user_id","thread_id");