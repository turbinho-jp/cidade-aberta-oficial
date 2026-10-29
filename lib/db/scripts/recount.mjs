// Confere (e, se pedido, corrige) os contadores denormalizados comparando-os com as linhas reais.
//
//   pnpm --filter @workspace/db run recount            # só mostra as diferenças (não altera nada)
//   pnpm --filter @workspace/db run recount -- --apply # grava os valores corretos
//
// Contadores de bairro, secretaria e categoria contam só demandas APROVADAS (is_approved).
// Não mexe em `users.points`: o total de pontos é recalculado a partir do histórico por
// `backfill-points.mjs`.
// Atenção: se o banco tem números de demonstração sem linhas por trás, --apply os substitui
// pelos reais. Rode primeiro sem --apply e confira.
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL não está definida.");
  process.exit(1);
}
const apply = process.argv.includes("--apply");

// `t` = linha da tabela alvo; cada `expected` é o valor que a coluna deveria ter.
const TARGETS = [
  ["neighborhoods", "demands_count", `(SELECT count(*)::int FROM demands d WHERE d.neighborhood_id = t.id AND d.is_approved)`],
  ["neighborhoods", "resolved_count", `(SELECT count(*)::int FROM demands d WHERE d.neighborhood_id = t.id AND d.is_approved AND d.status = 'completed')`],
  ["departments", "demands_count", `(SELECT count(*)::int FROM demands d WHERE d.department_id = t.id AND d.is_approved)`],
  ["departments", "resolved_count", `(SELECT count(*)::int FROM demands d WHERE d.department_id = t.id AND d.is_approved AND d.status = 'completed')`],
  ["categories", "demands_count", `(SELECT count(*)::int FROM demands d WHERE d.category_id = t.id AND d.is_approved)`],
  ["demands", "confirmations_count", `(SELECT count(*)::int FROM confirmations c WHERE c.demand_id = t.id)`],
  ["demands", "comments_count", `(SELECT count(*)::int FROM comments c WHERE c.demand_id = t.id AND c.is_moderated = false)`],
  ["users", "demands_count", `(SELECT count(*)::int FROM demands d WHERE d.author_id = t.id)`],
  ["users", "confirmations_count", `(SELECT count(*)::int FROM confirmations c WHERE c.user_id = t.id)`],
  ["users", "comments_count", `(SELECT count(*)::int FROM comments c WHERE c.author_id = t.id AND c.is_moderated = false)`],
  ["teams", "active_orders_count", `(SELECT count(*)::int FROM service_orders o WHERE o.team_id = t.id AND o.status IN ('pending', 'assigned', 'in_progress'))`],
  ["teams", "completed_orders_count", `(SELECT count(*)::int FROM service_orders o WHERE o.team_id = t.id AND o.status = 'completed')`],
];

const client = new pg.Client({ connectionString: url });
await client.connect();
let total = 0;
try {
  await client.query("BEGIN");
  for (const [table, col, expected] of TARGETS) {
    const { rows } = await client.query(
      `SELECT t.id, t."${col}" AS current, ${expected} AS expected FROM "${table}" t WHERE t."${col}" IS DISTINCT FROM ${expected} ORDER BY t.id`,
    );
    if (rows.length === 0) { console.log(`ok       ${table}.${col}`); continue; }
    total += rows.length;
    console.log(`DIFERE   ${table}.${col}: ${rows.length} linha(s)`);
    for (const r of rows.slice(0, 10)) console.log(`           id=${r.id}  atual=${r.current}  correto=${r.expected}`);
    if (rows.length > 10) console.log(`           ... e mais ${rows.length - 10}`);
    if (apply) {
      await client.query(`UPDATE "${table}" t SET "${col}" = ${expected} WHERE t."${col}" IS DISTINCT FROM ${expected}`);
    }
  }
  await client.query(apply ? "COMMIT" : "ROLLBACK");
  console.log(
    total === 0 ? "\nTudo consistente."
      : apply ? `\n${total} contador(es) corrigido(s).`
      : `\n${total} contador(es) divergente(s). Nada foi alterado; rode com --apply para corrigir.`,
  );
} catch (err) {
  await client.query("ROLLBACK").catch(() => {});
  console.error("[recount] Falhou:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
} finally {
  await client.end();
}
