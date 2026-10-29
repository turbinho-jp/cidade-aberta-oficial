-- Histórico de pontos da gamificação (ver lib/db/src/schema/point_transactions.ts).
-- IF NOT EXISTS: seguro de rodar à mão no SQL Editor do Neon e depois de novo via `migrate`.
CREATE TABLE IF NOT EXISTS "point_transactions" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"amount" integer NOT NULL,
	"reason" text NOT NULL,
	"demand_id" integer,
	"dedupe_key" text NOT NULL,
	"reversed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "point_transactions_dedupe_key_unique" UNIQUE("dedupe_key")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "point_transactions" ADD CONSTRAINT "point_transactions_demand_id_demands_id_fk" FOREIGN KEY ("demand_id") REFERENCES "public"."demands"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_transactions_user_created_idx" ON "point_transactions" USING btree ("user_id","created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_transactions_demand_id_idx" ON "point_transactions" USING btree ("demand_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "point_transactions_created_idx" ON "point_transactions" USING btree ("created_at");
