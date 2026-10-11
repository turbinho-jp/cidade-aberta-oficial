import { pgTable, serial, text, integer, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { demandsTable } from "./demands";
import { usersTable } from "./users";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const commentsTable = pgTable("comments", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").notNull().references(() => demandsTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  authorId: integer("author_id").notNull().references(() => usersTable.id, { onDelete: "restrict" }),
  authorName: text("author_name").notNull(),
  authorAvatarUrl: text("author_avatar_url"),
  isModerated: boolean("is_moderated").notNull().default(false),
  isOfficial: boolean("is_official").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("comments_demand_id_idx").on(t.demandId),
  index("comments_author_id_idx").on(t.authorId),
]);

export const insertCommentSchema = createInsertSchema(commentsTable).omit({ id: true, createdAt: true });
export type InsertComment = z.infer<typeof insertCommentSchema>;
export type Comment = typeof commentsTable.$inferSelect;
