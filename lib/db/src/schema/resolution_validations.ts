import { pgTable, serial, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";

/**
 * Validação comunitária: um cidadão confirma que uma demanda CONCLUÍDA foi mesmo resolvida.
 * Uma validação por pessoa em cada demanda. Os pontos ficam no histórico (point_transactions);
 * esta tabela guarda quem validou, inclusive as validações acima do teto que não pontuam.
 */
export const resolutionValidationsTable = pgTable("resolution_validations", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  unique("resolution_validations_demand_user_unique").on(t.demandId, t.userId),
  index("resolution_validations_user_id_idx").on(t.userId),
]);

export type ResolutionValidation = typeof resolutionValidationsTable.$inferSelect;
