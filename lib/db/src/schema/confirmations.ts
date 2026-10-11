import { pgTable, serial, integer, timestamp, unique, index } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const confirmationsTable = pgTable("confirmations", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  // Uma confirmação por usuário em cada demanda (também cobre buscas por demand_id).
  unique("confirmations_demand_user_unique").on(t.demandId, t.userId),
  index("confirmations_user_id_idx").on(t.userId),
]);

export const insertConfirmationSchema = createInsertSchema(confirmationsTable).omit({ id: true, createdAt: true });
export type InsertConfirmation = z.infer<typeof insertConfirmationSchema>;
export type Confirmation = typeof confirmationsTable.$inferSelect;
