-- Tentativas de login/cadastro para limitar abuso (lib/rate-limit.ts).
-- IF NOT EXISTS: seguro de rodar à mão no SQL Editor do Neon e depois de novo via `migrate`.
CREATE TABLE IF NOT EXISTS "auth_attempts" (
	"id" serial PRIMARY KEY NOT NULL,
	"key" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "auth_attempts_key_created_idx" ON "auth_attempts" USING btree ("key","created_at");
