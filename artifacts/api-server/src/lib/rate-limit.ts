import { db, authAttemptsTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

/**
 * Limite de tentativas de login e de cadastro, guardado no banco (a API roda em funções serverless:
 * um contador em memória não seria compartilhado). Só impede abuso em volume; não substitui senha forte.
 *
 * - Login: conta só tentativas que FALHARAM, por IP e por e-mail, numa janela de 15 minutos.
 *   Limite por IP maior que o por e-mail, porque vários cidadãos podem sair do mesmo IP (evento,
 *   Wi-Fi comunitário, operadora com IP compartilhado). Limite por e-mail barra quem tenta
 *   adivinhar a senha de uma conta específica a partir de IPs diferentes.
 *   Contrapartida conhecida: alguém pode errar de propósito a senha de outra pessoa e travar o
 *   login dela por até 15 minutos.
 * - Cadastro: conta toda tentativa, por IP, numa janela de 1 hora.
 */
const MINUTE = 60_000;
export const LOGIN_WINDOW_MS = 15 * MINUTE;
export const REGISTER_WINDOW_MS = 60 * MINUTE;
const LOGIN_MAX_FAILS_PER_IP = 30;
const LOGIN_MAX_FAILS_PER_EMAIL = 10;
const REGISTER_MAX_PER_IP = 20;

const ipKey = (kind: string, ip: string) => `${kind}:ip:${ip}`;
const emailKey = (kind: string, email: string) => `${kind}:email:${email.toLowerCase()}`;

// A comparação de tempo é feita DENTRO do banco (now() - intervalo), o mesmo relógio e fuso que
// grava created_at (coluna `timestamp` sem fuso). Comparar com um Date do Node quebra se o fuso do
// banco não for UTC.
async function countRecent(key: string, windowMs: number): Promise<number> {
  const [row] = await db.select({ n: sql<number>`count(*)::int` }).from(authAttemptsTable)
    .where(and(
      eq(authAttemptsTable.key, key),
      sql`${authAttemptsTable.createdAt} > now() - make_interval(secs => ${windowMs / 1000})`,
    ));
  return row?.n ?? 0;
}

async function record(keys: string[]) {
  await db.insert(authAttemptsTable).values(keys.map((key) => ({ key })));
  // Limpeza oportunista: linhas com mais de 1 dia não servem para nada.
  await db.delete(authAttemptsTable).where(sql`${authAttemptsTable.createdAt} < now() - interval '1 day'`);
}

/** true = bloquear este login (não conferir a senha). */
export async function isLoginBlocked(email: string, ip: string): Promise<boolean> {
  const [byIp, byEmail] = await Promise.all([
    countRecent(ipKey("login", ip), LOGIN_WINDOW_MS),
    countRecent(emailKey("login", email), LOGIN_WINDOW_MS),
  ]);
  return byIp >= LOGIN_MAX_FAILS_PER_IP || byEmail >= LOGIN_MAX_FAILS_PER_EMAIL;
}

export async function recordLoginFailure(email: string, ip: string) {
  await record([ipKey("login", ip), emailKey("login", email)]);
}

/** Registra a tentativa de cadastro e diz se passou do limite (true = bloquear). */
export async function registerAttemptBlocked(ip: string): Promise<boolean> {
  const n = await countRecent(ipKey("register", ip), REGISTER_WINDOW_MS);
  if (n >= REGISTER_MAX_PER_IP) return true;
  await record([ipKey("register", ip)]);
  return false;
}
