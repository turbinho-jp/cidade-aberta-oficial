import { Router } from "express";
import { db, confirmationsTable, demandsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireVerifiedEmail } from "../lib/auth";
import { parseId, sendValidationError } from "../lib/validate";
import { logActivity } from "../lib/activity";
import { canSee } from "../lib/visibility";
import { awardPoints, revokePoints, countActive, POINTS, SUPPORT_RECEIVED_CAP } from "../lib/gamification";

const router = Router();

router.post("/demands/:id/confirm", requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const demandId = parseId(req.params.id);
    if (demandId === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser;
    const [target] = await db.select({ id: demandsTable.id, isApproved: demandsTable.isApproved, authorId: demandsTable.authorId })
      .from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    if (!target || !canSee(currentUser, target)) { res.status(404).json({ error: "Not found" }); return; }

    // A unicidade (demand_id, user_id) é garantida pelo banco: dois cliques/requisições
    // simultâneas resultam em UMA confirmação, e só quem realmente inseriu mexe nos contadores.
    const result = await db.transaction(async (tx) => {
      const inserted = await tx.insert(confirmationsTable)
        .values({ demandId, userId: currentUser.id })
        .onConflictDoNothing({ target: [confirmationsTable.demandId, confirmationsTable.userId] })
        .returning({ id: confirmationsTable.id });

      if (inserted.length === 0) {
        const [demand] = await tx.select().from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
        return { created: false, demand };
      }
      const [demand] = await tx.update(demandsTable)
        .set({ confirmationsCount: sql`${demandsTable.confirmationsCount} + 1` })
        .where(eq(demandsTable.id, demandId)).returning();
      await tx.update(usersTable).set({
        confirmationsCount: sql`${usersTable.confirmationsCount} + 1`,
      }).where(eq(usersTable.id, currentUser.id));
      // Pontos só por apoiar a demanda de OUTRA pessoa (apoiar a própria não rende nada) e só em
      // demanda já publicada. A chave por (demanda, apoiador) faz apoiar/desapoiar em loop render
      // uma vez só; o autor tem teto de apoios que pontuam, para limitar contas de fachada.
      if (demand?.isApproved && demand.authorId !== currentUser.id) {
        await awardPoints(tx, {
          userId: currentUser.id, amount: POINTS.SUPPORT_GIVEN, reason: "support_given",
          dedupeKey: `support_given:${demandId}:${currentUser.id}`, demandId,
        });
        const receivedKey = `support_received:${demandId}:${currentUser.id}`;
        if ((await countActive(tx, { demandId, reason: "support_received" })) < SUPPORT_RECEIVED_CAP) {
          await awardPoints(tx, {
            userId: demand.authorId, amount: POINTS.SUPPORT_RECEIVED, reason: "support_received",
            dedupeKey: receivedKey, demandId,
          });
        }
      }
      return { created: true, demand };
    });

    // Fora da transação: logActivity usa outra conexão e só enxerga dados já confirmados.
    // O feed é público: não registra atividade de demanda ainda não aprovada.
    if (result.created && result.demand?.isApproved) {
      await logActivity({ type: "confirmation_added", description: `Nova confirmação em: ${result.demand?.title}`, demandId, demandTitle: result.demand?.title, actorName: currentUser.name });
    }
    res.json({ confirmed: true, total: result.demand?.confirmationsCount ?? 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/demands/:id/confirm", requireAuth, async (req, res) => {
  try {
    const demandId = parseId(req.params.id);
    if (demandId === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser;

    await db.transaction(async (tx) => {
      const removed = await tx.delete(confirmationsTable)
        .where(and(eq(confirmationsTable.demandId, demandId), eq(confirmationsTable.userId, currentUser.id)))
        .returning({ id: confirmationsTable.id });
      // Só desfaz contadores/pontos se havia confirmação: DELETEs repetidos não zeram nada,
      // e confirmar/desconfirmar em loop não rende pontos infinitos.
      if (removed.length === 0) return;
      await tx.update(demandsTable)
        .set({ confirmationsCount: sql`GREATEST(${demandsTable.confirmationsCount} - 1, 0)` })
        .where(eq(demandsTable.id, demandId));
      await tx.update(usersTable).set({
        confirmationsCount: sql`GREATEST(${usersTable.confirmationsCount} - 1, 0)`,
      }).where(eq(usersTable.id, currentUser.id));
      await revokePoints(tx, `support_given:${demandId}:${currentUser.id}`);
      await revokePoints(tx, `support_received:${demandId}:${currentUser.id}`);
    });
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
