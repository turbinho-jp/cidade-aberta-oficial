import { Router } from "express";
import { db, confirmationsTable, demandsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth } from "../lib/auth";
import { parseId, sendValidationError } from "../lib/validate";
import { logActivity } from "../lib/activity";

const router = Router();

const POINTS_PER_CONFIRMATION = 3;

router.post("/demands/:id/confirm", requireAuth, async (req, res) => {
  try {
    const demandId = parseId(req.params.id);
    if (demandId === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser;
    const [target] = await db.select({ id: demandsTable.id }).from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    if (!target) { res.status(404).json({ error: "Not found" }); return; }

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
        points: sql`${usersTable.points} + ${POINTS_PER_CONFIRMATION}`,
      }).where(eq(usersTable.id, currentUser.id));
      return { created: true, demand };
    });

    // Fora da transação: logActivity usa outra conexão e só enxerga dados já confirmados.
    if (result.created) {
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
        points: sql`GREATEST(${usersTable.points} - ${POINTS_PER_CONFIRMATION}, 0)`,
      }).where(eq(usersTable.id, currentUser.id));
    });
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
