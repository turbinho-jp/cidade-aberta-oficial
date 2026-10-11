import { pgTable, serial, text, integer, real, timestamp, pgEnum, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { neighborhoodsTable } from "./neighborhoods";
import { departmentsTable } from "./departments";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const publicWorkStatusEnum = pgEnum("public_work_status", [
  "planned", "approved", "in_progress", "completed", "suspended"
]);

export const publicWorksTable = pgTable("public_works", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: publicWorkStatusEnum("status").notNull().default("planned"),
  neighborhoodId: integer("neighborhood_id").notNull().references(() => neighborhoodsTable.id, { onDelete: "restrict" }),
  departmentId: integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }),
  investment: real("investment"),
  startDate: timestamp("start_date"),
  estimatedEnd: timestamp("estimated_end"),
  completedAt: timestamp("completed_at"),
  lat: real("lat"),
  lng: real("lng"),
  photoUrl: text("photo_url"),
  progressPercent: integer("progress_percent").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("public_works_neighborhood_id_idx").on(t.neighborhoodId),
  index("public_works_department_id_idx").on(t.departmentId),
  check("public_works_progress_percent_range", sql`${t.progressPercent} >= 0 AND ${t.progressPercent} <= 100`),
]);

export const insertPublicWorkSchema = createInsertSchema(publicWorksTable).omit({ id: true, createdAt: true });
export type InsertPublicWork = z.infer<typeof insertPublicWorkSchema>;
export type PublicWork = typeof publicWorksTable.$inferSelect;
