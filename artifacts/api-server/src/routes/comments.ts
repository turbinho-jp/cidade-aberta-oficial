import { Router } from "express";
import { db, commentsTable, demandsTable, usersTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireAuth, optionalAuth, isStaff } from "../lib/auth";
import { canSee } from "../lib/visibility";
import { publicName } from "../lib/public-name";
import { parseBody, parseId, sendValidationError, text } from "../lib/validate";
import { logActivity } from "../lib/activity";

const router = Router();

const POINTS_PER_COMMENT = 2;

router.get("/demands/:id/comments", optionalAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    // Demanda pendente de moderação: comentários só para o autor e a gestão.
    const [parent] = await db.select({ isApproved: demandsTable.isApproved, authorId: demandsTable.authorId })
      .from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!parent || !canSee((req as any).currentUser, parent)) { res.json([]); return; }
    const comments = await db.select().from(commentsTable)
      .where(and(eq(commentsTable.demandId, id), eq(commentsTable.isModerated, false)))
      .orderBy(commentsTable.createdAt);
    res.json(comments.map(c => ({
      id: c.id, demandId: c.demandId, content: c.content, authorId: c.authorId,
      authorName: c.isOfficial ? c.authorName : publicName(c.authorName), authorAvatarUrl: c.authorAvatarUrl,
      isModerated: c.isModerated, isOfficial: c.isOfficial, createdAt: c.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/demands/:id/comments", requireAuth, async (req, res) => {
  try {
    const demandId = parseId(req.params.id);
    if (demandId === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser;
    const body = parseBody(req.body, { content: text({ min: 1, max: 2000 }) });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { content } = body.value;

    const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    if (!demand || !canSee(currentUser, demand)) { res.status(404).json({ error: "Demand not found" }); return; }

    const isOfficial = isStaff(currentUser.role);
    const comment = await db.transaction(async (tx) => {
      const [created] = await tx.insert(commentsTable).values({
        demandId, content, authorId: currentUser.id, authorName: currentUser.name, isOfficial,
      }).returning();
      await tx.update(demandsTable).set({ commentsCount: sql`${demandsTable.commentsCount} + 1` }).where(eq(demandsTable.id, demandId));
      await tx.update(usersTable).set({ commentsCount: sql`${usersTable.commentsCount} + 1`, points: sql`${usersTable.points} + ${POINTS_PER_COMMENT}` }).where(eq(usersTable.id, currentUser.id));
      return created;
    });
    // O feed é público: atividade em demanda ainda não aprovada não pode vazar o título dela.
    if (demand.isApproved) await logActivity({ type: "comment_added", description: `Novo comentário em: ${demand.title}`, demandId, demandTitle: demand.title, actorName: currentUser.name });

    res.status(201).json({
      id: comment.id, demandId: comment.demandId, content: comment.content,
      authorId: comment.authorId, authorName: comment.isOfficial ? comment.authorName : publicName(comment.authorName),
      authorAvatarUrl: comment.authorAvatarUrl, isModerated: comment.isModerated,
      isOfficial: comment.isOfficial, createdAt: comment.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/comments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser;
    const [comment] = await db.select({ id: commentsTable.id, authorId: commentsTable.authorId })
      .from(commentsTable).where(eq(commentsTable.id, id)).limit(1);
    if (!comment) { res.status(404).json({ error: "Not found" }); return; }
    // Só a equipe da prefeitura (moderação) ou o próprio autor podem remover.
    if (!isStaff(currentUser.role) && comment.authorId !== currentUser.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    // A listagem esconde comentários moderados, então o contador precisa acompanhar. O filtro
    // `is_moderated = false` faz a remoção ser idempotente: repetir o DELETE não decrementa de novo.
    await db.transaction(async (tx) => {
      const [removed] = await tx.update(commentsTable).set({ isModerated: true })
        .where(and(eq(commentsTable.id, id), eq(commentsTable.isModerated, false)))
        .returning({ demandId: commentsTable.demandId, authorId: commentsTable.authorId });
      if (!removed) return;
      await tx.update(demandsTable)
        .set({ commentsCount: sql`GREATEST(${demandsTable.commentsCount} - 1, 0)` })
        .where(eq(demandsTable.id, removed.demandId));
      await tx.update(usersTable).set({
        commentsCount: sql`GREATEST(${usersTable.commentsCount} - 1, 0)`,
        points: sql`GREATEST(${usersTable.points} - ${POINTS_PER_COMMENT}, 0)`,
      }).where(eq(usersTable.id, removed.authorId));
    });
    res.status(204).send();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
