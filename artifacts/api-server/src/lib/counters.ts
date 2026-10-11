import { eq, sql } from "drizzle-orm";
import {
  type db,
  demandsTable,
  neighborhoodsTable,
  departmentsTable,
  teamsTable,
  serviceOrdersTable,
} from "@workspace/db";

/** Transação do Drizzle (o argumento recebido por `db.transaction(async (tx) => ...)`). */
export type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

/**
 * Contadores que DERIVAM do estado de outras linhas (demandas resolvidas por bairro/secretaria,
 * ordens ativas/concluídas por equipe) são recalculados a partir dos dados reais, em vez de
 * `+1`/`-1` espalhados pelas rotas. Assim eles se autocorrigem e não dependem de cada caminho
 * de código lembrar de ajustar o número.
 *
 * Concorrência: a linha do pai é travada com `FOR UPDATE` ANTES de contar. Quem chega depois
 * espera o commit de quem veio antes e então conta já enxergando essa mudança (READ COMMITTED
 * usa um snapshot novo a cada comando). Os ids são ordenados para evitar deadlock.
 *
 * Chame sempre DEPOIS de gravar a mudança que afeta a contagem, dentro da mesma transação.
 */
function distinctSorted(ids: ReadonlyArray<number | null | undefined>): number[] {
  return [...new Set(ids.filter((v): v is number => typeof v === "number"))].sort((a, b) => a - b);
}

export async function syncNeighborhoodCounters(tx: Tx, ids: ReadonlyArray<number | null | undefined>) {
  for (const id of distinctSorted(ids)) {
    await tx.select({ id: neighborhoodsTable.id }).from(neighborhoodsTable)
      .where(eq(neighborhoodsTable.id, id)).for("update");
    await tx.update(neighborhoodsTable).set({
      demandsCount: sql`(SELECT count(*)::int FROM ${demandsTable} WHERE ${demandsTable.neighborhoodId} = ${id})`,
      resolvedCount: sql`(SELECT count(*)::int FROM ${demandsTable} WHERE ${demandsTable.neighborhoodId} = ${id} AND ${demandsTable.status} = 'completed')`,
    }).where(eq(neighborhoodsTable.id, id));
  }
}

export async function syncDepartmentCounters(tx: Tx, ids: ReadonlyArray<number | null | undefined>) {
  for (const id of distinctSorted(ids)) {
    await tx.select({ id: departmentsTable.id }).from(departmentsTable)
      .where(eq(departmentsTable.id, id)).for("update");
    await tx.update(departmentsTable).set({
      demandsCount: sql`(SELECT count(*)::int FROM ${demandsTable} WHERE ${demandsTable.departmentId} = ${id})`,
      resolvedCount: sql`(SELECT count(*)::int FROM ${demandsTable} WHERE ${demandsTable.departmentId} = ${id} AND ${demandsTable.status} = 'completed')`,
    }).where(eq(departmentsTable.id, id));
  }
}

export async function syncTeamCounters(tx: Tx, ids: ReadonlyArray<number | null | undefined>) {
  for (const id of distinctSorted(ids)) {
    await tx.select({ id: teamsTable.id }).from(teamsTable)
      .where(eq(teamsTable.id, id)).for("update");
    await tx.update(teamsTable).set({
      activeOrdersCount: sql`(SELECT count(*)::int FROM ${serviceOrdersTable} WHERE ${serviceOrdersTable.teamId} = ${id} AND ${serviceOrdersTable.status} IN ('pending', 'assigned', 'in_progress'))`,
      completedOrdersCount: sql`(SELECT count(*)::int FROM ${serviceOrdersTable} WHERE ${serviceOrdersTable.teamId} = ${id} AND ${serviceOrdersTable.status} = 'completed')`,
    }).where(eq(teamsTable.id, id));
  }
}
