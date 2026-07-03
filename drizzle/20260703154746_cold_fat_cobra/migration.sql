CREATE TABLE "meals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid NOT NULL,
	"description" text NOT NULL,
	"logged_date" date NOT NULL,
	"calories" integer NOT NULL,
	"protein_g" numeric(8,2) NOT NULL,
	"carbs_g" numeric(8,2) NOT NULL,
	"fats_g" numeric(8,2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "meals_user_idx" ON "meals" ("user_id");--> statement-breakpoint
ALTER TABLE "meals" ADD CONSTRAINT "meals_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE;