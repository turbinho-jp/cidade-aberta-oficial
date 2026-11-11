-- Modo anônimo: o autor pode pedir para aparecer como "Cidadão(a)" no feed e nas páginas públicas.
-- IF NOT EXISTS: seguro de rodar à mão no SQL Editor do Neon e depois de novo via `migrate`.
-- Demandas já existentes ficam como estavam (is_anonymous = false).
ALTER TABLE "demands" ADD COLUMN IF NOT EXISTS "is_anonymous" boolean DEFAULT false NOT NULL;
