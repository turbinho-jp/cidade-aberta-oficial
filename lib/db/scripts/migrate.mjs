// Aplica as migrações versionadas (lib/db/drizzle) no banco apontado por DATABASE_URL.
//
//   pnpm --filter @workspace/db run migrate
//
// Bancos criados antes desta etapa com `drizzle-kit push` já têm as tabelas, mas nenhum
// histórico de migrações. Nesse caso a migração 0000 (baseline = o schema que o push criou)
// é registrada como já aplicada, SEM executá-la, e só as seguintes rodam.
//
// Bancos montados à mão (ex.: colando o SQL das migrações no SQL Editor do Neon) também não têm
// histórico. Para esses, cada migração seguinte cujo ÚLTIMO efeito já existe no banco (ver
// APPLIED_PROBES) também é registrada como aplicada, sem executar. Sem isso, a 0001 (ADD CONSTRAINT)
// e a 0002 (CREATE TABLE) falhariam com "already exists" e a migração nunca avançaria.
import path from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { readMigrationFiles } from "drizzle-orm/migrator";

const BASELINE_TABLES = [
  "activity_log", "categories", "comments", "confirmations", "demands", "departments",
  "neighborhoods", "public_works", "service_orders", "teams", "timeline_events", "users",
];

// Marcador do último efeito de cada migração (índice = posição no journal). Migrações novas, sem
// marcador aqui, nunca são "adotadas": sempre executam.
const APPLIED_PROBES = [
  null, // 0000_baseline: já conferido pela lista de tabelas acima
  `SELECT to_regclass('public.timeline_events_demand_id_idx') IS NOT NULL AS ok`, // 0001_integridade_referencial
  `SELECT to_regclass('public.attachments_uploaded_by_created_idx') IS NOT NULL AS ok`, // 0002_anexos
  `SELECT EXISTS (SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'demands' AND column_name = 'is_approved') AS ok`, // 0003_moderacao
  `SELECT to_regclass('public.auth_attempts_key_created_idx') IS NOT NULL AS ok`, // 0004_tentativas_login
  `SELECT to_regclass('public.point_transactions_created_idx') IS NOT NULL AS ok`, // 0005_pontos
  `SELECT to_regclass('public.resolution_validations_user_id_idx') IS NOT NULL AS ok`, // 0006_validacao_resolucao
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não está definida.");
  process.exit(1);
}

const migrationsFolder = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "drizzle");
const pool = new pg.Pool({ connectionString: url, max: 1 });

try {
  const migrations = readMigrationFiles({ migrationsFolder });
  if (migrations.length === 0) throw new Error(`Nenhuma migração encontrada em ${migrationsFolder}`);

  const { rows: [reg] } = await pool.query(
    `SELECT to_regclass('drizzle.__drizzle_migrations') IS NOT NULL AS has_history`,
  );
  let applied = 0;
  if (reg.has_history) {
    const { rows: [c] } = await pool.query(`SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations`);
    applied = c.n;
  }

  if (applied === 0) {
    const { rows } = await pool.query(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = ANY($1)`,
      [BASELINE_TABLES],
    );
    const found = new Set(rows.map((r) => r.table_name));
    if (found.size === BASELINE_TABLES.length) {
      // Banco já populado via `push`: adota o baseline sem recriar nada.
      const [baseline] = migrations;
      await pool.query(`CREATE SCHEMA IF NOT EXISTS "drizzle"`);
      await pool.query(
        `CREATE TABLE IF NOT EXISTS "drizzle"."__drizzle_migrations" (id SERIAL PRIMARY KEY, hash text NOT NULL, created_at bigint)`,
      );
      await pool.query(
        `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
        [baseline.hash, baseline.folderMillis],
      );
      console.log("[migrate] Banco existente detectado (criado via push): baseline 0000 registrado como aplicado.");
      // Migrações seguintes já aplicadas à mão: registra sem executar (para na primeira ausente).
      for (let i = 1; i < migrations.length; i++) {
        const probe = APPLIED_PROBES[i];
        if (!probe) break;
        const { rows: [r] } = await pool.query(probe);
        if (!r.ok) break;
        await pool.query(
          `INSERT INTO "drizzle"."__drizzle_migrations" ("hash", "created_at") VALUES ($1, $2)`,
          [migrations[i].hash, migrations[i].folderMillis],
        );
        console.log(`[migrate] Migração #${i} já estava aplicada no banco: registrada sem executar.`);
      }
    } else if (found.size > 0) {
      const missing = BASELINE_TABLES.filter((t) => !found.has(t));
      throw new Error(
        `Banco parcialmente criado: faltam as tabelas ${missing.join(", ")}. ` +
        `Não vou adivinhar o estado; corrija o banco manualmente (ou use um banco vazio) e rode de novo.`,
      );
    }
  }

  await migrate(drizzle(pool), { migrationsFolder });
  console.log("[migrate] Migrações em dia.");
} catch (err) {
  console.error("[migrate] Falhou:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await pool.end();
}
