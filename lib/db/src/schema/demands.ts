import { pgTable, serial, text, integer, real, boolean, timestamp, pgEnum, index, check } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { categoriesTable } from "./categories";
import { neighborhoodsTable } from "./neighborhoods";
import { departmentsTable } from "./departments";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const demandStatusEnum = pgEnum("demand_status", [
  "open", "under_review", "approved", "in_progress", "completed", "rejected", "closed"
]);

export const demandPriorityEnum = pgEnum("demand_priority", ["low", "medium", "high", "urgent"]);

export const demandsTable = pgTable("demands", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: demandStatusEnum("status").notNull().default("open"),
  priority: demandPriorityEnum("priority"),
  categoryId: integer("category_id").notNull().references(() => categoriesTable.id, { onDelete: "restrict" }),
  neighborhoodId: integer("neighborhood_id").notNull().references(() => neighborhoodsTable.id, { onDelete: "restrict" }),
  departmentId: integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }),
  address: text("address").notNull(),
  lat: real("lat").notNull(),
  lng: real("lng").notNull(),
  photoUrl: text("photo_url"),
  confirmationsCount: integer("confirmations_count").notNull().default(0),
  commentsCount: integer("comments_count").notNull().default(0),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  authorName: text("author_name").notNull(),
  publicResponse: text("public_response"),
  isApproved: boolean("is_approved").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  index("demands_status_idx").on(t.status),
  index("demands_category_id_idx").on(t.categoryId),
  index("demands_neighborhood_id_idx").on(t.neighborhoodId),
  index("demands_department_id_idx").on(t.departmentId),
  index("demands_author_id_idx").on(t.authorId),
  index("demands_created_at_idx").on(t.createdAt),
  check("demands_confirmations_count_nonneg", sql`${t.confirmationsCount} >= 0`),
  check("demands_comments_count_nonneg", sql`${t.commentsCount} >= 0`),
]);

export const insertDemandSchema = createInsertSchema(demandsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDemand = z.infer<typeof insertDemandSchema>;
export type Demand = typeof demandsTable.$inferSelect;
