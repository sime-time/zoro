CREATE TABLE "composio_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"thread_id" uuid NOT NULL,
	"composio_session_id" text NOT NULL,
	"toolkits" text[],
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "composio_sessions" ADD CONSTRAINT "composio_sessions_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "composio_sessions" ADD CONSTRAINT "composio_sessions_thread_id_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE;