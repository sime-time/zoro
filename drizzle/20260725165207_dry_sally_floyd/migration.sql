ALTER TABLE "routines" ADD COLUMN "thread_id" uuid NOT NULL;--> statement-breakpoint
CREATE INDEX "routines_thread_idx" ON "routines" ("thread_id");--> statement-breakpoint
ALTER TABLE "routines" ADD CONSTRAINT "routines_thread_id_threads_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "threads"("id") ON DELETE CASCADE;