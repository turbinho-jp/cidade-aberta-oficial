-- A coluna já existia no schema (lib/db/src/schema/demands.ts) e em bancos criados com `push`,
-- mas nenhuma migração a criava: um banco novo (DEPLOY.md) quebrava todas as consultas de demandas.
-- IF NOT EXISTS: seguro em bancos que já têm a coluna. DEFAULT true: demandas antigas continuam públicas.
ALTER TABLE "demands" ADD COLUMN IF NOT EXISTS "is_approved" boolean DEFAULT true NOT NULL;
