import { Router } from "express";
import { db, usersTable, demandsTable, categoriesTable, neighborhoodsTable } from "@workspace/db";
import { eq, desc, inArray, and } from "drizzle-orm";
import { optionalAuth } from "../lib/auth";
import { visibleTo } from "../lib/visibility";
import { publicName } from "../lib/public-name";
import { parseId, parseQuery, sendValidationError, paginationFields } from "../lib/validate";

const router = Router();

router.get("/users/:id/profile", optionalAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id)).limit(1);
    if (!user) { res.status(404).json({ error: "Not found" }); return; }
    const viewer = (req as any).currentUser as { id: number; role: string } | null;
    // Demandas pendentes de moderação só aparecem para o próprio autor e para a gestão.
    const recentDemands = await db.select().from(demandsTable)
      .where(and(eq(demandsTable.authorId, id), visibleTo(viewer)))
      .orderBy(desc(demandsTable.createdAt)).limit(5);
    const shownName = viewer?.id === id ? user.name : publicName(user.name);
    const catIds = [...new Set(recentDemands.map(d => d.categoryId))];
    const nbrIds = [...new Set(recentDemands.map(d => d.neighborhoodId))];
    const [cats, nbrs] = await Promise.all([
      catIds.length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds)) : [],
      nbrIds.length ? db.select().from(neighborhoodsTable).where(inArray(neighborhoodsTable.id, nbrIds)) : [],
    ]);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
    const nbrMap = Object.fromEntries(nbrs.map(n => [n.id, n]));
    res.json({
      id: user.id, name: shownName, role: user.role, avatarUrl: user.avatarUrl,
      points: user.points, demandsCount: user.demandsCount,
      confirmationsCount: user.confirmationsCount, commentsCount: user.commentsCount,
      rankPosition: null,
      recentDemands: recentDemands.map(d => ({
        id: d.id, title: d.title, status: d.status, priority: d.priority,
        categoryId: d.categoryId, category: catMap[d.categoryId],
        neighborhoodId: d.neighborhoodId, neighborhood: nbrMap[d.neighborhoodId],
        address: d.address, lat: d.lat, lng: d.lng,
        confirmationsCount: d.confirmationsCount, commentsCount: d.commentsCount,
        isConfirmedByMe: false, authorId: d.authorId, authorName: shownName,
        publicResponse: d.publicResponse, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
      })),
      createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/ranking", async (req, res) => {
  try {
    const q = parseQuery(req.query, { limit: paginationFields(100).limit });
    if (!q.ok) return sendValidationError(res, q.errors);
    const users = await db.select().from(usersTable)
      .orderBy(desc(usersTable.points)).limit(q.value.limit ?? 20);
    res.json(users.map((u, i) => ({
      userId: u.id, name: publicName(u.name), avatarUrl: u.avatarUrl,
      points: u.points, demandsCount: u.demandsCount,
      confirmationsCount: u.confirmationsCount, rank: i + 1,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
