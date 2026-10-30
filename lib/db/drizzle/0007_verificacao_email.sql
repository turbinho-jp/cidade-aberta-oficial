-- Verificação de e-mail (ver lib/db/src/schema/email_verification_tokens.ts e routes/auth.ts).
-- IF NOT EXISTS: seguro de rodar à mão no SQL Editor do Neon e depois de novo via `migrate`.
--
-- As contas que JÁ EXISTEM entram como verificadas: a coluna nasce com DEFAULT now() (o Postgres
-- preenche as linhas atuais com esse valor) e o default é removido logo em seguida, então toda conta
-- criada depois começa com NULL (= não verificada). Rodar de novo não toca em ninguém: o ADD COLUMN
-- não faz nada quando a coluna já existe.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "email_verified_at" timestamp DEFAULT now();
--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email_verified_at" DROP DEFAULT;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "email_verification_tokens" (
	"id" serial PRIMARY KEY NOT NULL,
	"user_id" integer NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "email_verification_tokens_user_id_idx" ON "email_verification_tokens" USING btree ("user_id");
