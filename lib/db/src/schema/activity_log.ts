import { pgTable, serial, text, integer, timestamp, pgEnum, index } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityTypeEnum = pgEnum("activity_type", [
  "demand_created", "demand_resolved", "comment_added",
  "status_changed", "service_order_created", "confirmation_added"
]);

export const activityLogTable = pgTable("activity_log", {
  id: serial("id").primaryKey(),
  type: activityTypeEnum("type").notNull(),
  description: text("description").notNull(),
  // SET NULL: o feed público preserva o histórico (demand_title é gravado junto) se a demanda sumir.
  demandId: integer("demand_id").references(() => demandsTable.id, { onDelete: "set null" }),
  demandTitle: text("demand_title"),
  actorName: text("actor_name"),
  neighborhoodName: text("neighborhood_name"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("activity_log_created_at_idx").on(t.createdAt),
  index("activity_log_demand_id_idx").on(t.demandId),
]);

export const insertActivityLogSchema = createInsertSchema(activityLogTable).omit({ id: true, createdAt: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogTable.$inferSelect;
