import { Router } from "express";
import { db, announcementsTable, departmentsTable, neighborhoodsTable, categoriesTable } from "@workspace/db";
import { eq, and, or, isNull, gt, desc, inArray } from "drizzle-orm";
import { requireAdmin, optionalAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import {
  parseBody, parseQuery, parseId, sendValidationError,
  text, int, oneOf, optional, nullable, bool,
} from "../lib/validate";

const router = Router();

const SCOPES = ["municipal", "estadual", "comunitario"] as const;

function formatAnnouncement(a: any, dept?: any, nbr?: any, cat?: any) {
  return {
    id: a.id,
    title: a.title,
    body: a.body,
    scope: a.scope,
    departmentId: a.departmentId,
    department: dept ? { id: dept.id, name: dept.name } : undefined,
    neighborhoodId: a.neighborhoodId,
    neighborhood: nbr ? { id: nbr.id, name: nbr.name } : undefined,
    categoryId: a.categoryId,
    category: cat ? { id: cat.id, name: cat.name, icon: cat.icon, color: cat.color } : undefined,
    imageUrl: a.imageUrl,
    lat: a.lat,
    lng: a.lng,
    isPublished: a.isPublished,
    publishedAt: a.publishedAt.toISOString(),
    expiresAt: a.expiresAt ? a.expiresAt.toISOString() : null,
  };
}

// Lista avisos publicados e não expirados (público)
router.get("/announcements", optionalAuth, async (req, res) => {
  try {
    const q = parseQuery(req.query, {
      scope: optional(oneOf(SCOPES), { blankAsMissing: true }),
      neighborhoodId: optional(int(), { blankAsMissing: true }),
      categoryId: optional(int(), { blankAsMissing: true }),
      includeExpired: optional(oneOf(["true", "false", "1", "0"] as const), { blankAsMissing: true }),
    });
    if (!q.ok) return sendValidationError(res, q.errors);

    const { scope, neighborhoodId, categoryId } = q.value;
    const includeExpired = q.value.includeExpired === "true" || q.value.includeExpired === "1";
    const currentUser = (req as any).currentUser;
    const isAdmin = currentUser?.role === "admin" || currentUser?.role === "secretary";

    const now = new Date();
    const conditions: any[] = [];

    if (!isAdmin || !includeExpired) {
      conditions.push(eq(announcementsTable.isPublished, true));
      conditions.push(or(isNull(announcementsTable.expiresAt), gt(announcementsTable.expiresAt, now)));
    }
    if (scope) conditions.push(eq(announcementsTable.scope, scope));
    if (neighborhoodId) conditions.push(eq(announcementsTable.neighborhoodId, neighborhoodId));
    if (categoryId) conditions.push(eq(announcementsTable.categoryId, categoryId));

    const items = await db
      .select()
      .from(announcementsTable)
      .where(conditions.length ? and(...conditions) : undefined)
      .orderBy(desc(announcementsTable.publishedAt))
      .limit(100);

    const deptIds = [...new Set(items.filter(i => i.departmentId).map(i => i.departmentId!))];
    const nbrIds = [...new Set(items.filter(i => i.neighborhoodId).map(i => i.neighborhoodId!))];
    const catIds = [...new Set(items.filter(i => i.categoryId).map(i => i.categoryId!))];

    const [depts, nbrs, cats] = await Promise.all([
      deptIds.length ? db.select().from(departmentsTable).where(inArray(departmentsTable.id, deptIds)) : [],
      nbrIds.length ? db.select().from(neighborhoodsTable).where(inArray(neighborhoodsTable.id, nbrIds)) : [],
      catIds.length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds)) : [],
    ]);

    const deptMap = Object.fromEntries(depts.map(d => [d.id, d]));
    const nbrMap = Object.fromEntries(nbrs.map(n => [n.id, n]));
    const catMap = Object.fromEntries(cats.map(c => [c.id, c]));

    res.json({
      announcements: items.map(i =>
        formatAnnouncement(
          i,
          i.departmentId ? deptMap[i.departmentId] : undefined,
          i.neighborhoodId ? nbrMap[i.neighborhoodId] : undefined,
          i.categoryId ? catMap[i.categoryId] : undefined,
        ),
      ),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Cria um novo aviso oficial (apenas admin/secretaria)
router.post("/announcements", requireAdmin, async (req, res) => {
  try {
    const currentUser = (req as any).currentUser as { id: number; name: string };
    const body = parseBody(req.body, {
      title: text({ min: 5, max: 180 }),
      body: text({ min: 10, max: 5000 }),
      scope: optional(oneOf(SCOPES)),
      departmentId: optional(nullable(int())),
      neighborhoodId: optional(nullable(int())),
      categoryId: optional(nullable(int())),
      imageUrl: optional(nullable(text({ min: 10, max: 2_000_000 })), { blankAsMissing: true }),
      expiresAt: optional(nullable(text({ min: 8, max: 40 })), { blankAsMissing: true }),
      isPublished: optional(bool()),
    });
    if (!body.ok) return sendValidationError(res, body.errors);

    const { title, body: content, scope, departmentId, neighborhoodId, categoryId, imageUrl, expiresAt, isPublished } = body.value;
    const lat = typeof req.body.lat === "number" ? req.body.lat : null;
    const lng = typeof req.body.lng === "number" ? req.body.lng : null;

    let parsedExpiresAt: Date | null = null;
    if (expiresAt) {
      const d = new Date(expiresAt);
      if (Number.isNaN(d.getTime())) {
        return sendValidationError(res, { expiresAt: "data de expiração inválida" });
      }
      parsedExpiresAt = d;
    }

    const [created] = await db
      .insert(announcementsTable)
      .values({
        title,
        body: content,
        scope: scope ?? "municipal",
        departmentId: departmentId ?? null,
        neighborhoodId: neighborhoodId ?? null,
        categoryId: categoryId ?? null,
        imageUrl: imageUrl || null,
        lat,
        lng,
        isPublished: isPublished ?? true,
        expiresAt: parsedExpiresAt,
        createdBy: currentUser.id,
      })
      .returning();

    if (created.isPublished) {
      await logActivity({
        type: "announcement",
        description: `Aviso oficial: ${created.title}`,
        actorName: currentUser.name,
      });
    }

    res.status(201).json(formatAnnouncement(created));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Remove um aviso (apenas admin/secretaria)
router.delete("/announcements/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [deleted] = await db.delete(announcementsTable).where(eq(announcementsTable.id, id)).returning();
    if (!deleted) return res.status(404).json({ error: "Not found" });
    res.json({ ok: true });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;