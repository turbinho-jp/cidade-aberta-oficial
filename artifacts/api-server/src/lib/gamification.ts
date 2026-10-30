import { and, eq, isNull, isNotNull, sql } from "drizzle-orm";
import { pointTransactionsTable, usersTable, type PointReason } from "@workspace/db";
import type { Tx } from "./counters";

/**
 * Pontuação da gamificação. Todos os valores ficam aqui para ajustar num lugar só.
 *
 * Os pontos só são concedidos por fatos que passaram por moderação ou por outra pessoa
 * (demanda APROVADA, apoio de OUTRO cidadão, demanda CONCLUÍDA pelo órgão), nunca só por
 * "criar algo". Isso é o que segura spam e contas de fachada.
 */
export const POINTS = {
  /** Autor, quando a demanda é publicada (aprovada pela moderação). */
  DEMAND_PUBLISHED: 10,
  /** Quem apoia a demanda de outra pessoa. */
  SUPPORT_GIVEN: 2,
  /** Autor, por cada apoio de outra pessoa na sua demanda. */
  SUPPORT_RECEIVED: 5,
  /** Comentário (só conta para as primeiras COMMENTS_PER_DEMAND_CAP de cada pessoa por demanda). */
  COMMENT: 2,
  /** Autor, quando o órgão responsável conclui a demanda. */
  DEMAND_RESOLVED: 50,
  /** Quem confirma que a demanda de outra pessoa foi mesmo resolvida. */
  RESOLUTION_VALIDATED: 15,
  /** Autor, por cada confirmação de que a sua demanda foi mesmo resolvida. */
  RESOLUTION_VALIDATION_RECEIVED: 15,
} as const;

/** Limite de apoios que rendem pontos ao autor por demanda (50 pontos no máximo). */
export const SUPPORT_RECEIVED_CAP = 10;
/** Validações de resolução que rendem pontos por demanda (cada uma paga a quem valida e ao autor). */
export const RESOLUTION_VALIDATIONS_CAP = 3;
/** Comentários que rendem pontos, por pessoa e por demanda. */
export const COMMENTS_PER_DEMAND_CAP = 3;

/** Chaves dos dois lançamentos de uma validação de resolução (quem valida e o autor). */
export const resolutionValidationKeys = (demandId: number, userId: number) =>
  [`resolution_validated:${demandId}:${userId}`, `resolution_validation_received:${demandId}:${userId}`] as const;

interface Award {
  userId: number;
  amount: number;
  reason: PointReason;
  /** Identifica o fato que gera os pontos; o mesmo fato nunca pontua duas vezes. */
  dedupeKey: string;
  demandId?: number | null;
}

/**
 * Concede pontos pelo fato `dedupeKey`. Devolve `true` se os pontos foram de fato somados
 * (primeira vez, ou fato que tinha sido desfeito e voltou a valer) e `false` se já estavam
 * valendo. Chamar dentro da transação que grava o fato.
 */
export async function awardPoints(tx: Tx, a: Award): Promise<boolean> {
  const rows = await tx.insert(pointTransactionsTable)
    .values({
      userId: a.userId, amount: a.amount, reason: a.reason,
      demandId: a.demandId ?? null, dedupeKey: a.dedupeKey,
    })
    .onConflictDoUpdate({
      target: pointTransactionsTable.dedupeKey,
      // Só "reativa" uma linha desfeita; se já está ativa, não faz nada (e não devolve linha).
      set: { reversedAt: null, createdAt: sql`now()` },
      setWhere: isNotNull(pointTransactionsTable.reversedAt),
    })
    .returning({ id: pointTransactionsTable.id });
  if (rows.length === 0) return false;
  await tx.update(usersTable)
    .set({ points: sql`${usersTable.points} + ${a.amount}` })
    .where(eq(usersTable.id, a.userId));
  return true;
}

/**
 * Desfaz os pontos do fato `dedupeKey` (apoio removido, comentário moderado, demanda reaberta).
 * Idempotente: repetir não subtrai de novo. Devolve `true` se algo foi desfeito.
 */
export async function revokePoints(tx: Tx, dedupeKey: string): Promise<boolean> {
  const rows = await tx.update(pointTransactionsTable)
    .set({ reversedAt: new Date() })
    .where(and(eq(pointTransactionsTable.dedupeKey, dedupeKey), isNull(pointTransactionsTable.reversedAt)))
    .returning({ userId: pointTransactionsTable.userId, amount: pointTransactionsTable.amount });
  for (const r of rows) {
    await tx.update(usersTable)
      .set({ points: sql`GREATEST(${usersTable.points} - ${r.amount}, 0)` })
      .where(eq(usersTable.id, r.userId));
  }
  return rows.length > 0;
}

/** Quantas linhas ATIVAS existem com esse motivo (e filtros) para a demanda. Usado nos tetos. */
export async function countActive(
  tx: Tx,
  where: { demandId: number; reason: PointReason; userId?: number },
): Promise<number> {
  const [row] = await tx.select({ n: sql<number>`count(*)::int` })
    .from(pointTransactionsTable)
    .where(and(
      eq(pointTransactionsTable.demandId, where.demandId),
      eq(pointTransactionsTable.reason, where.reason),
      isNull(pointTransactionsTable.reversedAt),
      where.userId !== undefined ? eq(pointTransactionsTable.userId, where.userId) : undefined,
    ));
  return row?.n ?? 0;
}

/** Início do mês corrente no fuso de Fortaleza (UTC-3, sem horário de verão), como instante UTC. */
export function startOfCurrentMonth(now = new Date()): Date {
  const local = new Date(now.getTime() - 3 * 3600_000);
  return new Date(Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), 1, 3, 0, 0));
}
