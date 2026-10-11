import { Router } from "express";
import { db, departmentsTable, demandsTable, categoriesTable, neighborhoodsTable } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { parseId, sendValidationError } from "../lib/validate";

const router = Router();

router.get("/departments", async (req, res) => {
  try {
    const depts = await db.select().from(departmentsTable).orderBy(departmentsTable.name);
    res.json(depts.map(d => ({
      id: d.id, name: d.name, description: d.description, logoUrl: d.logoUrl,
      demandsCount: d.demandsCount, resolvedCount: d.resolvedCount,
      avgResolutionDays: d.avgResolutionDays, efficiencyIndex: d.efficiencyIndex,
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/departments/:id/stats", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [dept] = await db.select().from(departmentsTable).where(eq(departmentsTable.id, id)).limit(1);
    if (!dept) { res.status(404).json({ error: "Not found" }); return; }
    const demands = await db.select().from(demandsTable).where(eq(demandsTable.departmentId, id)).orderBy(desc(demandsTable.createdAt)).limit(10);
    const catIds = [...new Set(demands.map(d => d.categoryId))];
    const nbrIds = [...new Set(demands.map(d => d.neighborhoodId))];
    const [cats, nbrs] = await Promise.all([
      catIds.length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds)) : [],
      nbrIds.length ? db.select().from(neighborhoodsTable).where(inArray(neighborhoodsTable.id, nbrIds)) : [],
    ]);
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));
    const nbrMap = Object.fromEntries(nbrs.map(n => [n.id, n]));
    const resolved = demands.filter(d => d.status === "completed").length;
    const inProgress = demands.filter(d => d.status === "in_progress").length;
    const rejected = demands.filter(d => d.status === "rejected").length;
    res.json({
      departmentId: id,
      totalDemands: dept.demandsCount,
      resolved: dept.resolvedCount,
      inProgress,
      rejected,
      avgResolutionDays: dept.avgResolutionDays ?? 0,
      efficiencyIndex: dept.efficiencyIndex ?? 0,
      recentDemands: demands.map(d => ({
        id: d.id, title: d.title, status: d.status, priority: d.priority,
        categoryId: d.categoryId, category: catMap[d.categoryId],
        neighborhoodId: d.neighborhoodId, neighborhood: nbrMap[d.neighborhoodId],
        address: d.address, lat: d.lat, lng: d.lng,
        confirmationsCount: d.confirmationsCount, commentsCount: d.commentsCount,
        authorId: d.authorId, authorName: d.authorName, publicResponse: d.publicResponse,
        createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
