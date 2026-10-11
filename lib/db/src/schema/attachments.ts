import { pgTable, serial, text, integer, timestamp, index, check, customType } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { demandsTable } from "./demands";
import { publicWorksTable } from "./public_works";
import { usersTable } from "./users";

/** Coluna `bytea` ↔ Buffer (o driver `pg` já entrega/recebe Buffer). */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return "bytea";
  },
});

/**
 * Fotos/anexos de demandas e obras públicas, guardados no próprio PostgreSQL
 * (sem serviço de armazenamento extra, sem SDK, sem custo adicional).
 * Cada linha pertence a exatamente UMA demanda OU UMA obra (check abaixo).
 * Ao listar, NUNCA selecione `data`: ele só é lido por GET /api/attachments/:id.
 */
export const attachmentsTable = pgTable("attachments", {
  id: serial("id").primaryKey(),
  demandId: integer("demand_id").references(() => demandsTable.id, { onDelete: "cascade" }),
  publicWorkId: integer("public_work_id").references(() => publicWorksTable.id, { onDelete: "cascade" }),
  uploadedById: integer("uploaded_by_id").references(() => usersTable.id, { onDelete: "set null" }),
  mimeType: text("mime_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  data: bytea("data").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("attachments_demand_id_idx").on(t.demandId),
  index("attachments_public_work_id_idx").on(t.publicWorkId),
  index("attachments_uploaded_by_created_idx").on(t.uploadedById, t.createdAt),
  check("attachments_single_owner", sql`(${t.demandId} IS NOT NULL)::int + (${t.publicWorkId} IS NOT NULL)::int = 1`),
  check("attachments_size_positive", sql`${t.sizeBytes} > 0`),
]);

export type Attachment = typeof attachmentsTable.$inferSelect;
