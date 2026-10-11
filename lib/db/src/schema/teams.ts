import { pgTable, serial, text, integer, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const teamsTable = pgTable("teams", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  area: text("area").notNull(),
  description: text("description"),
  activeOrdersCount: integer("active_orders_count").notNull().default(0),
  completedOrdersCount: integer("completed_orders_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  check("teams_active_orders_count_nonneg", sql`${t.activeOrdersCount} >= 0`),
  check("teams_completed_orders_count_nonneg", sql`${t.completedOrdersCount} >= 0`),
]);

export const insertTeamSchema = createInsertSchema(teamsTable).omit({ id: true, createdAt: true });
export type InsertTeam = z.infer<typeof insertTeamSchema>;
export type Team = typeof teamsTable.$inferSelect;
