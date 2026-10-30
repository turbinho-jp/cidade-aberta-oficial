import { pgTable, serial, integer, text, timestamp, index } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

/**
 * Link de confirmação de e-mail. Guarda só o HASH (SHA-256) do token: quem ler o banco não consegue
 * montar um link válido. Cada token vale uma vez e expira (ver routes/auth.ts); pedir um novo link
 * apaga os anteriores da mesma pessoa.
 */
export const emailVerificationTokensTable = pgTable("email_verification_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("email_verification_tokens_user_id_idx").on(t.userId),
]);
