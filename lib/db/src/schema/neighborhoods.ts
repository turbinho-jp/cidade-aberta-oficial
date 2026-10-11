import { pgTable, serial, text, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const neighborhoodsTable = pgTable("neighborhoods", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  demandsCount: integer("demands_count").notNull().default(0),
  resolvedCount: integer("resolved_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  check("neighborhoods_demands_count_nonneg", sql`${t.demandsCount} >= 0`),
  check("neighborhoods_resolved_count_nonneg", sql`${t.resolvedCount} >= 0`),
]);

export const insertNeighborhoodSchema = createInsertSchema(neighborhoodsTable).omit({ id: true, createdAt: true });
export type InsertNeighborhood = z.infer<typeof insertNeighborhoodSchema>;
export type Neighborhood = typeof neighborhoodsTable.$inferSelect;
