import { Router } from "express";
import { db, demandsTable, categoriesTable, neighborhoodsTable, departmentsTable, timelineTable, confirmationsTable, serviceOrdersTable, teamsTable, usersTable, demandStatusEnum, demandPriorityEnum, resolutionValidationsTable } from "@workspace/db";
import { eq, and, or, sql, ilike, desc, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, optionalAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { notifyDemandAuthor, NOTIFIABLE_STATUSES } from "../lib/notify";
import type { StatusEmailKind } from "../lib/mailer";
import { awardPoints, revokePoints, POINTS, resolutionValidationKeys } from "../lib/gamification";
import { isManager as isStaff, visibleTo, canSee, type Viewer } from "../lib/visibility";
import { publicNameOrNull, demandAuthorName, ANONYMOUS_NAME } from "../lib/public-name";
import { buildAutoTitle } from "../lib/demand-title";
import { syncNeighborhoodCounters, syncDepartmentCounters, type Tx } from "../lib/counters";
import { loadAttachmentMeta, type AttachmentMeta } from "./attachments";
import { serviceAreaLat, serviceAreaLng } from "../lib/geo";
import { canTransition } from "../lib/demand-status";
import {
  parseBody, parseQuery, parseId, sendValidationError, paginationFields, escapeLike,
  text, int, oneOf, optional, nullable, httpUrl, bool,
} from "../lib/validate";

const router = Router();

// Moderação: demanda de cidadão nasce pendente (is_approved = false) e só aparece
// publicamente depois da aprovação. O autor e a equipe (admin/secretário) sempre a enxergam.

/**
 * Efeitos de uma demanda se tornar pública: contadores de bairro/categoria e pontos do autor.
 * Chamar UMA vez por demanda, dentro da transação, depois de gravar `is_approved = true`
 * (na criação por equipe ou na aprovação de uma pendente).
 */
async function creditPublication(tx: Tx, d: { id: number; neighborhoodId: number; categoryId: number; authorId: number }) {
  await syncNeighborhoodCounters(tx, [d.neighborhoodId]);
  await tx.update(categoriesTable).set({ demandsCount: sql`${categoriesTable.demandsCount} + 1` }).where(eq(categoriesTable.id, d.categoryId));
  await awardPoints(tx, { userId: d.authorId, amount: POINTS.DEMAND_PUBLISHED, reason: "demand_published", dedupeKey: `demand_published:${d.id}`, demandId: d.id });
}

function formatDemand(d: any, category?: any, neighborhood?: any, department?: any, isConfirmedByMe = false, attachments: AttachmentMeta[] = [], viewer?: Viewer) {
  // Demanda anônima: o público nunca recebe o id do autor (daria para abrir o perfil dele). Só o próprio autor e a gestão.
  const showAuthorId = !d.isAnonymous || (!!viewer && (viewer.id === d.authorId || isStaff(viewer)));
  return {
    id: d.id,
    title: d.title,
    description: d.description,
    status: d.status,
    priority: d.priority,
    categoryId: d.categoryId,
    category: category ? { id: category.id, name: category.name, icon: category.icon, color: category.color } : undefined,
    neighborhoodId: d.neighborhoodId,
    neighborhood: neighborhood ? { id: neighborhood.id, name: neighborhood.name } : undefined,
    departmentId: d.departmentId,
    department: department ? { id: department.id, name: department.name, description: department.description } : undefined,
    address: d.address,
    lat: d.lat,
    lng: d.lng,
    photoUrl: d.photoUrl,
    attachments,
    confirmationsCount: d.confirmationsCount,
    commentsCount: d.commentsCount,
    isConfirmedByMe,
    authorId: showAuthorId ? d.authorId : 0,
    authorName: demandAuthorName(d),
    isAnonymous: !!d.isAnonymous,
    publicResponse: d.publicResponse,
    isApproved: d.isApproved,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  };
}

router.get("/demands", optionalAuth, async (req, res) => {
  try {
    const q = parseQuery(req.query, {
      status: optional(oneOf(demandStatusEnum.enumValues), { blankAsMissing: true }),
      categoryId: optional(int(), { blankAsMissing: true }),
      neighborhoodId: optional(int(), { blankAsMissing: true }),
      departmentId: optional(int(), { blankAsMissing: true }),
      search: optional(text({ min: 1, max: 100 }), { blankAsMissing: true }),
      ...paginationFields(500),
    });
    if (!q.ok) return sendValidationError(res, q.errors);
    const { status, categoryId, neighborhoodId, departmentId, search } = q.value;
    const limit = q.value.limit ?? 20;
    const offset = q.value.offset ?? 0;
    const currentUser = (req as any).currentUser;
    const conditions: any[] = [];
    const visibility = visibleTo(currentUser);
    if (visibility) conditions.push(visibility);
    if (status) conditions.push(eq(demandsTable.status, status));
    if (categoryId) conditions.push(eq(demandsTable.categoryId, categoryId));
    if (neighborhoodId) conditions.push(eq(demandsTable.neighborhoodId, neighborhoodId));
    if (departmentId) conditions.push(eq(demandsTable.departmentId, departmentId));
    if (search) {
      const pattern = `%${escapeLike(search)}%`;
      conditions.push(or(ilike(demandsTable.title, pattern), ilike(demandsTable.description, pattern)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;
    const [demands, [{ count }]] = await Promise.all([
      db.select().from(demandsTable).where(where).orderBy(desc(demandsTable.createdAt)).limit(limit).offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(demandsTable).where(where),
    ]);

    let confirmedIds = new Set<number>();
    if (currentUser) {
      const confirmations = await db.select({ demandId: confirmationsTable.demandId })
        .from(confirmationsTable).where(eq(confirmationsTable.userId, currentUser.id));
      confirmedIds = new Set(confirmations.map(c => c.demandId));
    }

    const catIds = [...new Set(demands.map(d => d.categoryId))];
    const nbrIds = [...new Set(demands.map(d => d.neighborhoodId))];
    const [categories, neighborhoods, attachmentsByDemand] = await Promise.all([
      catIds.length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds)) : [],
      nbrIds.length ? db.select().from(neighborhoodsTable).where(inArray(neighborhoodsTable.id, nbrIds)) : [],
      loadAttachmentMeta("demand", demands.map(d => d.id)),
    ]);
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const nbrMap = Object.fromEntries(neighborhoods.map(n => [n.id, n]));

    res.json({
      demands: demands.map(d => formatDemand(d, catMap[d.categoryId], nbrMap[d.neighborhoodId], undefined, confirmedIds.has(d.id), attachmentsByDemand.get(d.id), currentUser)),
      total: count,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Fila de moderação. Precisa vir ANTES de "/demands/:id", senão "pending" seria lido como id.
router.get("/demands/pending", requireAdmin, async (req, res) => {
  try {
    const demands = await db.select().from(demandsTable)
      .where(and(eq(demandsTable.isApproved, false), eq(demandsTable.status, "open")))
      .orderBy(desc(demandsTable.createdAt))
      .limit(100);

    const catIds = [...new Set(demands.map(d => d.categoryId))];
    const nbrIds = [...new Set(demands.map(d => d.neighborhoodId))];
    const [categories, neighborhoods, attachmentsByDemand] = await Promise.all([
      catIds.length ? db.select().from(categoriesTable).where(inArray(categoriesTable.id, catIds)) : [],
      nbrIds.length ? db.select().from(neighborhoodsTable).where(inArray(neighborhoodsTable.id, nbrIds)) : [],
      loadAttachmentMeta("demand", demands.map(d => d.id)),
    ]);
    const catMap = Object.fromEntries(categories.map(c => [c.id, c]));
    const nbrMap = Object.fromEntries(neighborhoods.map(n => [n.id, n]));

    res.json({
      demands: demands.map(d => formatDemand(d, catMap[d.categoryId], nbrMap[d.neighborhoodId], undefined, false, attachmentsByDemand.get(d.id), (req as any).currentUser)),
      total: demands.length,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/demands", requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).currentUser;
    const body = parseBody(req.body, {
      // Sem título (ou em branco), o servidor monta "[Categoria] em [Bairro] — [Endereço curto]".
      title: optional(text({ min: 5, max: 150 }), { blankAsMissing: true }),
      description: text({ min: 10, max: 5000 }),
      categoryId: int(),
      neighborhoodId: int(),
      address: text({ min: 5, max: 300 }),
      lat: serviceAreaLat(),
      lng: serviceAreaLng(),
      photoUrl: optional(httpUrl(), { blankAsMissing: true }),
      isAnonymous: optional(bool()),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { title: givenTitle, description, categoryId, neighborhoodId, address, lat, lng, photoUrl } = body.value;
    const isAnonymous = body.value.isAnonymous === true;

    const [[category], [neighborhood]] = await Promise.all([
      db.select({ id: categoriesTable.id, name: categoriesTable.name }).from(categoriesTable).where(eq(categoriesTable.id,