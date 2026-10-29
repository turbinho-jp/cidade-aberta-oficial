import { Router } from "express";
import { db, usersTable, demandsTable, categoriesTable, neighborhoodsTable, pointTransactionsTable } from "@workspace/db";
import { eq, desc, inArray, notInArray, gt, gte, and, isNull, sql } from "drizzle-orm";
import { optionalAuth, requireAuth } from "../lib/auth";
import { startOfCurrentMonth } from "../lib/gamification";
import { visibleTo } from "../lib/visibility";
import { publicName } from "../lib/public-name";
import { parseId, parseQuery, sendValidationError, paginationFields, optional, int, oneOf } from "../lib/validate";

const router = Router();

const STAFF_ROLES = ["admin", "secretary", "moderator"] as const;

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
    // Posição no ranking geral (mesma regra de /users/ranking: só cidadãos que já pontuaram).
    let rankPosition: number | null = null;
    if (!(STAFF_ROLES as readonly string[]).includes(user.role) && user.points > 0) {
      const [{ ahead }] = await db.select({ ahead: sql<number>`count(*)::int` }).from(usersTable)
        .where(and(notInArray(usersTable.role, [...STAFF_ROLES]), gt(usersTable.points, user.points)));
      rankPosition = ahead + 1;
    }
    res.json({
      id: user.id, name: shownName, role: user.role, avatarUrl: user.avatarUrl,
      points: user.points, demandsCount: user.demandsCount,
      confirmationsCount: user.confirmationsCount, commentsCount: user.commentsCount,
      rankPosition,
      recentDemands: recentDemands.map(d => ({
        id: d.id, title: d.title, status: d.status, priority: d.priority,
        categoryId: d.categoryId, category: catMap[d.categoryId],
        neighborhoodId: d.neighborhoodId, neighborhood: nbrMap[d.neighborhoodId],
        address: d.address, lat: d.lat, lng: d.lng,
        confirmationsCount: d.confirmationsCount, commentsCount: d.commentsCount,
        isConfirmedByMe: false, authorId: d.authorId, authorName: shownName,
        publicResponse: d.publicResponse, isApproved: d.isApproved,
        createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
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
    const q = parseQuery(req.query, {
      limit: paginationFields(100).limit,
      period: optional(oneOf(["all", "month"] as const), { blankAsMissing: true }),
      neighborhoodId: optional(int(), { blankAsMissing: true }),
    });
    if (!q.ok) return sendValidationError(res, q.errors);
    const limit = q.value.limit ?? 20;
    const { period, neighborhoodId } = q.value;

    // Ranking público de cidadãos: sem contas da prefeitura e sem quem ainda não pontuou.
    if (period !== "month" && neighborhoodId === undefined) {
      const users = await db.select().from(usersTable)
        .where(and(notInArray(usersTable.role, [...STAFF_ROLES]), gt(usersTable.points, 0)))
        .orderBy(desc(usersTable.points)).limit(limit);
      res.json(users.map((u, i) => ({
        userId: u.id, name: publicName(u.name), avatarUrl: u.avatarUrl,
        points: u.points, demandsCount: u.demandsCount,
        confirmationsCount: u.confirmationsCount, rank: i + 1,
      })));
      return;
    }

    // Mensal e/ou por bairro: soma do histórico de pontos (só linhas ativas). O bairro é o da
    // demanda que gerou os pontos. `points` na resposta passa a ser o total DO PERÍODO/BAIRRO.
    const total = sql<number>`sum(${pointTransactionsTable.amount})::int`;
    const rows = await db.select({ userId: pointTransactionsTable.userId, points: total })
      .from(pointTransactionsTable)
      .innerJoin(usersTable, eq(usersTable.id, pointTransactionsTable.userId))
      .leftJoin(demandsTable, eq(demandsTable.id, pointTransactionsTable.demandId))
      .where(and(
        isNull(pointTransactionsTable.reversedAt),
        notInArray(usersTable.role, [...STAFF_ROLES]),
        period === "month" ? gte(pointTransactionsTable.createdAt, startOfCurrentMonth()) : undefined,
        neighborhoodId !== undefined ? eq(demandsTable.neighborhoodId, neighborhoodId) : undefined,
      ))
      .groupBy(pointTransactionsTable.userId)
      .having(sql`sum(${pointTransactionsTable.amount}) > 0`)
      .orderBy(desc(total), pointTransactionsTable.userId)
      .limit(limit);
    const ids = rows.map(r => r.userId);
    const users = ids.length ? await db.select().from(usersTable).where(inArray(usersTable.id, ids)) : [];
    const byId = new Map(users.map(u => [u.id, u]));
    res.json(rows.flatMap((r, i) => {
      const u = byId.get(r.userId);
      return u ? [{
        userId: u.id, name: publicName(u.name), avatarUrl: u.avatarUrl,
        points: r.points, demandsCount: u.demandsCount,
        confirmationsCount: u.confirmationsCount, rank: i + 1,
      }] : [];
    }));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Histórico de pontos da própria pessoa ("por que ganhei isso?"). Só linhas ativas.
router.get("/users/me/points", requireAuth, async (req, res) => {
  try {
    const q = parseQuery(req.query, { limit: paginationFields(100).limit });
    if (!q.ok) return sendValidationError(res, q.errors);
    const currentUser = (req as any).currentUser as { id: number };
    const rows = await db.select({
      id: pointTransactionsTable.id, amount: pointTransactionsTable.amount,
      reason: pointTransactionsTable.reason, demandId: pointTransactionsTable.demandId,
      demandTitle: demandsTable.title, createdAt: pointTransactionsTable.createdAt,
    }).from(pointTransactionsTable)
      .leftJoin(demandsTable, eq(demandsTable.id, pointTransactionsTable.demandId))
      .where(and(eq(pointTransactionsTable.userId, currentUser.id), isNull(pointTransactionsTable.reversedAt)))
      .orderBy(desc(pointTransactionsTable.createdAt), desc(pointTransactionsTable.id))
      .limit(q.value.limit ?? 20);
    res.json(rows.map(r => ({
      id: r.id, amount: r.amount, reason: r.reason, demandId: r.demandId,
      demandTitle: r.demandTitle, createdAt: r.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
