// Reconstrói o histórico de pontos (point_transactions) a partir dos dados reais e recalcula
// `users.points` como a soma desse histórico. Rode UMA vez depois da migração 0005.
//
//   pnpm --filter @workspace/db run backfill-points            # só mostra o que mudaria
//   pnpm --filter @workspace/db run backfill-points -- --apply # grava
//
// Regras (as mesmas de artifacts/api-server/src/lib/gamification.ts — mantenha em sincronia):
//   demanda publicada (aprovada)            +10 ao autor
//   apoio em demanda de OUTRA pessoa        +2 ao apoiador, +5 ao autor (até 10 apoios por demanda)
//   comentário (3 primeiros por pessoa/demanda, em demanda aprovada, não moderado)  +2
//   demanda concluída (aprovada)            +50 ao autor
// Atenção: isto SUBSTITUI o total atual de cada usuário pelo recalculado. Como as regras mudaram
// (apoio valia 3, agora 2; novos pontos por demanda concluída etc.), alguns totais vão mudar.
// Rode primeiro sem --apply e confira a tabela. É idempotente (ON CONFLICT DO NOTHING).
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) { console.error("DATABASE_URL não está definida."); process.exit(1); }
const apply = process.argv.includes("--apply");

const INSERTS = [
  `INSERT INTO point_transactions (user_id, amount, reason, demand_id, dedupe_key, created_at)
     SELECT d.author_id, 10, 'demand_published', d.id, 'demand_published:' || d.id, d.created_at
     FROM demands d WHERE d.is_approved
     ON CONFLICT (dedupe_key) DO NOTHING`,
  `INSERT INTO point_transactions (user_id, amount, reason, demand_id, dedupe_key, created_at)
     SELECT c.user_id, 2, 'support_given', c.demand_id, 'support_given:' || c.demand_id || ':' || c.user_id, c.created_at
     FROM confirmations c JOIN demands d ON d.id = c.demand_id
     WHERE d.is_approved AND d.author_id <> c.user_id
     ON CONFLICT (dedupe_key) DO NOTHING`,
  `INSERT INTO point_transactions (user_id, amount, reason, demand_id, dedupe_key, created_at)
     SELECT x.author_id, 5, 'support_received', x.demand_id, 'support_received:' || x.demand_id || ':' || x.user_id, x.created_at
     FROM (
       SELECT c.demand_id, c.user_id, c.created_at, d.author_id,
              row_number() OVER (PARTITION BY c.demand_id ORDER BY c.created_at, c.id) AS rn
       FROM confirmations c JOIN demands d ON d.id = c.demand_id
       WHERE d.is_approved AND d.author_id <> c.user_id
     ) x WHERE x.rn <= 10
     ON CONFLICT (dedupe_key) DO NOTHING`,
  `INSERT INTO point_transactions (user_id, amount, reason, demand_id, dedupe_key, created_at)
     SELECT x.author_id, 2, 'comment_posted', x.demand_id, 'comment:' || x.id, x.created_at
     FROM (
       SELECT c.id, c.author_id, c.demand_id, c.created_at,
              row_number() OVER (PARTITION BY c.demand_id, c.author_id ORDER BY c.created_at, c.id) AS rn
       FROM comments c JOIN demands d ON d.id = c.demand_id
       WHERE d.is_approved AND NOT c.is_moderated
     ) x WHERE x.rn <= 3
     ON CONFLICT (dedupe_key) DO NOTHING`,
  `INSERT INTO point_transactions (user_id, amount, reason, demand_id, dedupe_key, created_at)
     SELECT d.author_id, 50, 'demand_resolved', d.id, 'demand_resolved:' || d.id, d.updated_at
     FROM demands d WHERE d.is_approved AND d.status = 'completed'
     ON CONFLICT (dedupe_key) DO NOTHING`,
];

const client = new pg.Client({ connectionString: url });
await client.connect();
try {
  await client.query("BEGIN");
  for (const q of INSERTS) await client.query(q);
  const { rows } = await client.query(
    `SELECT u.id, u.name, u.role, u.points AS atual,
            COALESCE((SELECT sum(p.amount) FROM point_transactions p WHERE p.user_id = u.id AND p.reversed_at IS NULL), 0)::int AS novo
     FROM users u
     WHERE u.points IS DISTINCT FROM COALESCE((SELECT sum(p.amount) FROM point_transactions p WHERE p.user_id = u.id AND p.reversed_at IS NULL), 0)
     ORDER BY u.id`,
  );
  if (rows.length === 0) console.log("ok       users.points já bate com o histórico");
  for (const r of rows) console.log(`DIFERE   id=${r.id} ${r.name} (${r.role}): atual=${r.atual}  novo=${r.novo}`);
  if (apply) {
    await client.query(
      `UPDATE users u SET points = COALESCE((SELECT sum(p.amount) FROM point_transactions p WHERE p.user_id = u.id AND p.reversed_at IS NULL), 0)`,
    );
    await client.query("COMMIT");
    console.log(`\nAplicado. ${rows.length} usuário(s) com total ajustado.`);
  } else {
    await client.query("ROLLBACK");
    console.log("\nNada foi gravado (rode com --apply para gravar).");
  }
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error(err);
  process.exitCode = 1;
} finally {
  await client.end();
}
