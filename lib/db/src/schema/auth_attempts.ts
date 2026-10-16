import { pgTable, serial, text, timestamp, index } from "drizzle-orm/pg-core";

/**
 * Tentativas recentes de login (só as que falharam) e de cadastro, usadas para limitar abuso.
 * Fica no banco porque a API roda em funções serverless (Vercel): um contador em memória não é
 * compartilhado entre instâncias. `key` = "login:ip:<ip>", "login:email:<email>" ou "register:ip:<ip>".
 * Linhas com mais de 1 dia são apagadas durante o uso normal (ver lib/rate-limit.ts).
 */
export const authAttemptsTable = pgTable("auth_attempts", {
  id: serial("id").primaryKey(),
  key: text("key").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [
  index("auth_attempts_key_created_idx").on(t.key, t.createdAt),
]);
