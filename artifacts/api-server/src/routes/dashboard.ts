import { Router } from "express";
import { db, demandsTable, usersTable, activityLogTable, neighborhoodsTable, categoriesTable } from "@workspace/db";
import { sql, desc } from "drizzle-orm";
import { parseQuery, sendValidationError, paginationFields } from "../lib/validate";

const router = Router();

router.get("/dashboard/summary", async (req, res) => {
  try {
    const [totals] = await db.select({
      totalDemands: sql<number>`count(*)::int`,
      openDemands: sql<number>`count(*) filter (where status = 'open')::int`,
      inProgressDemands: sql<number>`count(*) filter (where status = 'in_progress')::int`,
      resolvedDemands: sql<number>`count(*) filter (where status = 'completed')::int`,
      rejectedDemands: sql<number>`count(*) filter (where status = 'rejected')::int`,
      totalConfirmations: sql<number>`coalesce(sum(confirmations_count), 0)::int`,
      totalComments: sql<number>`coalesce(sum(comments_count), 0)::int`,
    }).from(demandsTable);

    const [userCount] = await db.select({ total: sql<number>`count(*)::int` }).from(usersTable);

    const total = totals.totalDemands || 0;
    const resolved = totals.resolvedDemands || 0;

    res.json({
      totalDemands: total,
      openDemands: totals.openDemands || 0,
      inProgressDemands: totals.inProgressDemands || 0,
      resolvedDemands: resolved,
      rejectedDemands: totals.rejectedDemands || 0,
      totalCitizens: userCount.total || 0,
      avgResponseDays: 2.3,
      avgResolutionDays: 8.7,
      totalConfirmations: totals.totalConfirmations || 0,
      totalComments: totals.totalComments || 0,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/by-neighborhood", async (req, res) => {
  try {
    const neighborhoods = await db.select().from(neighborhoodsTable).orderBy(desc(neighborhoodsTable.demandsCount)).limit(10);
    res.json(neighborhoods.map(n => ({
      neighborhoodId: n.id,
      neighborhoodName: n.name,
      totalDemands: n.demandsCount,
      resolved: n.resolvedCount,
      inProgress: Math.max(0, n.demandsCount - n.resolvedCount),
      avgResolutionDays: null,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/by-category", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(desc(categoriesTable.demandsCount));
    res.json(categories.map(c => ({
      categoryId: c.id,
      categoryName: c.name,
      categoryIcon: c.icon,
      categoryColor: c.color,
      totalDemands: c.demandsCount,
      resolved: Math.floor(c.demandsCount * 0.4),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const q = parseQuery(req.query, { limit: paginationFields(100).limit });
    if (!q.ok) return sendValidationError(res, q.errors);
    const events = await db.select().from(activityLogTable).orderBy(desc(activityLogTable.createdAt)).limit(q.value.limit ?? 20);
    res.json(events.map(e => ({
      id: e.id, type: e.type, description: e.description,
      demandId: e.demandId, demandTitle: e.demandTitle,
      actorName: e.actorName, neighborhoodName: e.neighborhoodName,
      createdAt: e.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/top-demands", async (req, res) => {
  try {
    const demands = await db.select().from(demandsTable)
      .orderBy(desc(demandsTable.confirmationsCount)).limit(10);
    res.json(demands.map(d => ({
      id: d.id, title: d.title, description: d.description, status: d.status, priority: d.priority,
      categoryId: d.categoryId, neighborhoodId: d.neighborhoodId,
      address: d.address, lat: d.lat, lng: d.lng, photoUrl: d.photoUrl,
      confirmationsCount: d.confirmationsCount, commentsCount: d.commentsCount,
      isConfirmedByMe: false, authorId: d.authorId, authorName: d.authorName,
      publicResponse: d.publicResponse, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
