ALTER TABLE "composio_sessions" ADD COLUMN "last_error" text;--> statement-breakpoint
CREATE UNIQUE INDEX "composio_sessions_session_idx" ON "composio_sessions" ("composio_session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "composio_sessions_user_thread_active_idx" ON "composio_sessions" ("user_id","thread_id","is_active");--> statement-breakpoint
CREATE INDEX "composio_sessions_user_idx" ON "composio_sessions" ("user_id");--> statement-breakpoint
CREATE INDEX "composio_sessions_thread_idx" ON "composio_sessions" ("thread_id");