import { pgTable, serial, text, integer, real, timestamp, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const departmentsTable = pgTable("departments", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  logoUrl: text("logo_url"),
  demandsCount: integer("demands_count").notNull().default(0),
  resolvedCount: integer("resolved_count").notNull().default(0),
  avgResolutionDays: real("avg_resolution_days"),
  efficiencyIndex: real("efficiency_index"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  check("departments_demands_count_nonneg", sql`${t.demandsCount} >= 0`),
  check("departments_resolved_count_nonneg", sql`${t.resolvedCount} >= 0`),
]);

export const insertDepartmentSchema = createInsertSchema(departmentsTable).omit({ id: true, createdAt: true });
export type InsertDepartment = z.infer<typeof insertDepartmentSchema>;
export type Department = typeof departmentsTable.$inferSelect;
