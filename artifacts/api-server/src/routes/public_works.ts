import { Router } from "express";
import { db, publicWorksTable, neighborhoodsTable, departmentsTable, publicWorkStatusEnum } from "@workspace/db";
import { eq, desc, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { loadAttachmentMeta, type AttachmentMeta } from "./attachments";
import { serviceAreaLat, serviceAreaLng } from "../lib/geo";
import {
  parseBody, parseQuery, parseId, sendValidationError, paginationFields,
  text, int, num, oneOf, isoDate, optional, nullable,
} from "../lib/validate";

const router = Router();

function formatWork(w: any, neighborhood?: any, attachments: AttachmentMeta[] = []) {
  return {
    id: w.id, title: w.title, description: w.description, status: w.status,
    neighborhoodId: w.neighborhoodId, neighborhood: neighborhood ? { id: neighborhood.id, name: neighborhood.name } : undefined,
    departmentId: w.departmentId, investment: w.investment,
    startDate: w.startDate?.toISOString() ?? null,
    estimatedEnd: w.estimatedEnd?.toISOString() ?? null,
    completedAt: w.completedAt?.toISOString() ?? null,
    lat: w.lat, lng: w.lng, photoUrl: w.photoUrl, attachments,
    progressPercent: w.progressPercent, createdAt: w.createdAt.toISOString(),
  };
}

router.get("/public-works", async (req, res) => {
  try {
    const q = parseQuery(req.query, {
      status: optional(oneOf(publicWorkStatusEnum.enumValues), { blankAsMissing: true }),
      ...paginationFields(200),
    });
    if (!q.ok) return sendValidationError(res, q.errors);
    const { status } = q.value;
    const limit = q.value.limit ?? 20;
    const works = await db.select().from(publicWorksTable)
      .where(status ? eq(publicWorksTable.status, status) : undefined)
      .orderBy(desc(publicWorksTable.createdAt)).limit(limit);
    const nbrIds = [...new Set(works.map(w => w.neighborhoodId))];
    const neighborhoods = nbrIds.length ? await db.select().from(neighborhoodsTable).where(inArray(neighborhoodsTable.id, nbrIds)) : [];
    const nbrMap = Object.fromEntries(neighborhoods.map(n => [n.id, n]));
    const attachmentsByWork = await loadAttachmentMeta("publicWork", works.map(w => w.id));
    res.json(works.map(w => formatWork(w, nbrMap[w.neighborhoodId], attachmentsByWork.get(w.id))));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/public-works", requireAdmin, async (req, res) => {
  try {
    const body = parseBody(req.body, {
      title: text({ min: 3, max: 150 }),
      description: text({ min: 3, max: 5000 }),
      status: oneOf(publicWorkStatusEnum.enumValues),
      neighborhoodId: int(),
      departmentId: optional(nullable(int())),
      investment: optional(nullable(num({ min: 0, max: 1e12 }))),
      startDate: optional(nullable(isoDate())),
      estimatedEnd: optional(nullable(isoDate())),
      lat: optional(nullable(serviceAreaLat())),
      lng: optional(nullable(serviceAreaLng())),
      progressPercent: optional(int({ min: 0, max: 100 })),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { title, description, status, neighborhoodId, departmentId, investment, startDate, estimatedEnd, lat, lng, progressPercent } = body.value;
    if ((lat == null) !== (lng == null)) {
      return sendValidationError(res, { lat: "informe latitude e longitude juntas", lng: "informe latitude e longitude juntas" });
    }
    const [neighborhood] = await db.select({ id: neighborhoodsTable.id }).from(neighborhoodsTable).where(eq(neighborhoodsTable.id, neighborhoodId)).limit(1);
    if (!neighborhood) return sendValidationError(res, { neighborhoodId: "bairro não encontrado" });
    if (departmentId) {
      const [dept] = await db.select({ id: departmentsTable.id }).from(departmentsTable).where(eq(departmentsTable.id, departmentId)).limit(1);
      if (!dept) return sendValidationError(res, { departmentId: "secretaria não encontrada" });
    }
    const [work] = await db.insert(publicWorksTable).values({
      title, description, status, neighborhoodId,
      departmentId: departmentId || null,
      investment: investment ?? null,
      startDate: startDate ?? null,
      estimatedEnd: estimatedEnd ?? null,
      lat: lat ?? null, lng: lng ?? null,
      progressPercent: progressPercent ?? 0,
    }).returning();
    res.status(201).json(formatWork(work));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/public-works/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [work] = await db.select().from(publicWorksTable).where(eq(publicWorksTable.id, id)).limit(1);
    if (!work) { res.status(404).json({ error: "Not found" }); return; }
    const [neighborhood] = await db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, work.neighborhoodId)).limit(1);
    const attachmentsByWork = await loadAttachmentMeta("publicWork", [id]);
    res.json(formatWork(work, neighborhood, attachmentsByWork.get(id)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
