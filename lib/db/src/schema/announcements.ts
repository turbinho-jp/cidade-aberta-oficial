import { pgTable, serial, text, integer, boolean, timestamp, real } from "drizzle-orm/pg-core";
import { departmentsTable } from "./departments";
import { neighborhoodsTable } from "./neighborhoods";
import { categoriesTable } from "./categories";
import { usersTable } from "./users";

export const announcementsTable = pgTable("announcements", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  scope: text("scope").default("municipal").notNull(), // 'municipal' | 'estadual' | 'comunitario'
  departmentId: integer("department_id").references(() => departmentsTable.id, { onDelete: "set null" }),
  neighborhoodId: integer("neighborhood_id").references(() => neighborhoodsTable.id, { onDelete: "set null" }),
  categoryId: integer("category_id").references(() => categoriesTable.id, { onDelete: "set null" }),
  imageUrl: text("image_url"),
  lat: real("lat"),
  lng: real("lng"),
  isPublished: boolean("is_published").default(true).notNull(),
  publishedAt: timestamp("published_at").defaultNow().notNull(),
  expiresAt: timestamp("expires_at"),
  createdBy: integer("created_by").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
});