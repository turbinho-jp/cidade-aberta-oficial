-- Validação comunitária de resolução (ver lib/db/src/schema/resolution_validations.ts).
-- IF NOT EXISTS: seguro de rodar à mão no SQL Editor do Neon e depois de novo via `migrate`.
CREATE TABLE IF NOT EXISTS "resolution_validations" (
	"id" serial PRIMARY KEY NOT NULL,
	"demand_id" integer NOT NULL,
	"user_id" integer NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "resolution_validations_demand_user_unique" UNIQUE("demand_id","user_id")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resolution_validations" ADD CONSTRAINT "resolution_validations_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "resolution_validations" ADD CONSTRAINT "resolution_validations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "resolution_validations_user_id_idx" ON "resolution_validations" USING btree ("user_id");
