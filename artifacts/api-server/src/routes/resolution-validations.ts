import { Router } from "express";
import { db, demandsTable, resolutionValidationsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, requireVerifiedEmail } from "../lib/auth";
import { parseId, sendValidationError } from "../lib/validate";
import { canSee } from "../lib/visibility";
import {
  awardPoints, revokePoints, countActive, resolutionValidationKeys,
  POINTS, RESOLUTION_VALIDATIONS_CAP,
} from "../lib/gamification";

const router = Router();

const STAFF_ROLES = ["admin", "secretary", "moderator"];

// Confirmar que uma demanda CONCLUÍDA foi mesmo resolvida ("conferi no local"). Vale uma vez por
// pessoa (unicidade no banco). Não valida quem é do órgão nem o próprio autor: a ideia é a
// comunidade conferir o trabalho, não a prefeitura nem o interessado se autoconfirmarem.
router.post("/demands/:id/validate-resolution", requireAuth, requireVerifiedEmail, async (req, res) => {
  try {
    const demandId = parseId(req.params.id);
    if (demandId === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser;

    const outcome = await db.transaction(async (tx) => {
      // Trava a linha da demanda: duas validações simultâneas não furam o teto de pontos.
      const [demand] = await tx.select().from(demandsTable).where(eq(demandsTable.id, demandId)).for("update").limit(1);
      if (!demand || !canSee(currentUser, demand)) return { status: 404 as const };
      if (STAFF_ROLES.includes(currentUser.role) || demand.authorId === currentUser.id) return { status: 403 as const };
      if (demand.status !== "completed") return { status: 409 as const };

      const inserted = await tx.insert(resolutionValidationsTable)
        .values({ demandId, userId: currentUser.id })
        .onConflictDoNothing({ target: [resolutionValidationsTable.demandId, resolutionValidationsTable.userId] })
        .returning({ id: resolutionValidationsTable.id });

      if (inserted.length > 0
        && (await countActive(tx, { demandId, reason: "resolution_validated" })) < RESOLUTION_VALIDATIONS_CAP) {
        const [validatorKey, authorKey] = resolutionValidationKeys(demandId, currentUser.id);
        await awardPoints(tx, {
          userId: currentUser.id, amount: POINTS.RESOLUTION_VALIDATED, reason: "resolution_validated",
          dedupeKey: validatorKey, demandId,
        });
        await awardPoints(tx, {
          userId: demand.authorId, amount: POINTS.RESOLUTION_VALIDATION_RECEIVED, reason: "resolution_validation_received",
          dedupeKey: authorKey, demandId,
        });
      }
      const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` })
        .from(resolutionValidationsTable).where(eq(resolutionValidationsTable.demandId, demandId));
      return { status: 200 as const, total: n };
    });

    if (outcome.status === 404) { res.status(404).json({ error: "Not found" }); return; }
    if (outcome.status === 403) { res.status(403).json({ error: "Quem criou a demanda e a equipe da prefeitura não podem validar a resolução" }); return; }
    if (outcome.status === 409) { res.status(409).json({ error: "Só dá para validar demandas já concluídas" }); return; }
    res.json({ validated: true, total: outcome.total });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/demands/:id/validate-resolution", requireAuth, async (req, res) => {
  try {
    const demandId = parseId(req.params.id);
    if (demandId === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser;

    await db.transaction(async (tx) => {
      const removed = await tx.delete(resolutionValidationsTable)
        .where(and(eq(resolutionValidationsTable.demandId, demandId), eq(resolutionValidationsTable.userId, currentUser.id)))
        .returning({ id: resolutionValidationsTable.id });
      // DELETEs repetidos não desfazem nada de novo (revokePoints também é idempotente).
      if (removed.length === 0) return;
      for (const key of resolutionValidationKeys(demandId, currentUser.id)) await revokePoints(tx, key);
    });
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
