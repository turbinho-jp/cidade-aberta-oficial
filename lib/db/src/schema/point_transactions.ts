import { pgTable, serial, text, integer, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { demandsTable } from "./demands";

/**
 * Histórico (ledger) de pontos. Cada linha é um ganho de pontos; `users.points` é o total em cache
 * (soma das linhas ativas, `reversed_at IS NULL`).
 *
 * `dedupe_key` é único e identifica o FATO que gerou os pontos (ex.: "demand_resolved:42"). É ele
 * que impede pontuar duas vezes pelo mesmo fato (reabrir/concluir de novo, apoiar/desapoiar em loop).
 * Quando o fato é desfeito (apoio removido, comentário moderado), a linha ganha `reversed_at` em vez
 * de ser apagada; se o fato voltar a valer, a mesma linha é reativada.
 */
export const POINT_REASONS = [
  "demand_published", // demanda sua foi publicada (aprovada)
  "support_given", // você apoiou a demanda de outra pessoa
  "support_received", // alguém apoiou a sua demanda
  "comment_posted", // comentário em demanda
  "demand_resolved", // demanda sua foi concluída pelo órgão responsável
  "resolution_validated", // você confirmou que a demanda de outra pessoa foi mesmo resolvida
  "resolution_validation_received", // alguém confirmou que a sua demanda foi mesmo resolvida
] as const;
export type PointReason = (typeof POINT_REASONS)[number];

export const pointTransactionsTable = pgTable("point_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(),
  reason: text("reason").$type<PointReason>().notNull(),
  // SET NULL: o histórico do cidadão sobrevive se a demanda for apagada.
  demandId: integer("demand_id").references(() => demandsTable.id, { onDelete: "set null" }),
  dedupeKey: text("dedupe_key").notNull().unique(),
  reversedAt: timestamp("reversed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("point_transactions_user_created_idx").on(t.userId, t.createdAt),
  index("point_transactions_demand_id_idx").on(t.demandId),
  index("point_transactions_created_idx").on(t.createdAt),
]);

export type PointTransaction = typeof pointTransactionsTable.$inferSelect;
