import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { sendDemandStatusEmail, NOTIFIABLE_STATUSES, type StatusEmailKind } from "./mailer";
import { logger } from "./logger";

export { NOTIFIABLE_STATUSES };

/**
 * Avisa o autor da demanda por e-mail. Só envia se o autor tem e-mail verificado.
 * NUNCA lança: o chamador já gravou a mudança, e uma falha de SMTP/banco aqui só é registrada no log.
 * Retorna true se o servidor SMTP aceitou a mensagem.
 */
export async function notifyDemandAuthor(
  demand: { id: number; title: string; authorId: number },
  kind: StatusEmailKind,
  message?: string | null,
): Promise<boolean> {
  try {
    const [author] = await db
      .select({ email: usersTable.email, name: usersTable.name, verified: usersTable.emailVerifiedAt })
      .from(usersTable)
      .where(eq(usersTable.id, demand.authorId))
      .limit(1);
    if (!author?.email || !author.verified) {
      logger.info({ demandId: demand.id, kind }, "Aviso de status não enviado: autor sem e-mail verificado");
      return false;
    }
    return await sendDemandStatusEmail(author.email, author.name, { id: demand.id, title: demand.title }, kind, message);
  } catch (err) {
    logger.error({ err, demandId: demand.id, kind }, "Falha ao preparar o aviso de status ao autor");
    return false;
  }
}
