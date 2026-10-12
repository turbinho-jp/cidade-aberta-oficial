import { Router } from "express";
import { db, demandsTable, categoriesTable, neighborhoodsTable, departmentsTable, timelineTable, confirmationsTable, serviceOrdersTable, teamsTable, usersTable, demandStatusEnum, demandPriorityEnum } from "@workspace/db";
import { eq, and, or, sql, ilike, desc, inArray } from "drizzle-orm";
import { requireAuth, requireAdmin, optionalAuth } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { syncNeighborhoodCounters, syncDepartmentCounters } from "../lib/counters";
import { loadAttachmentMeta, type AttachmentMeta } from "./attachments";
import { serviceAreaLat, serviceAreaLng } from "../lib/geo";
import {
  parseBody, parseQuery, parseId, sendValidationError, paginationFields, escapeLike,
  text, int, oneOf, optional, nullable, httpUrl,
} from "../lib/validate";

const router = Router();

// Moderação: demanda de cidadão nasce pendente (is_approved = false) e só aparece
// publicamente depois da aprovação. O autor e a equipe (admin/secretário) sempre a enxergam.
const isStaff = (u: any) => !!u && (u.role === "admin" || u.role === "secretary");
const visibleTo = (u: any) =>
  isStaff(u)
    ? undefined
    : u
      ? or(eq(demandsTable.isApproved, true), eq(demandsTable.authorId, u.id))
      : eq(demandsTable.isApproved, true);
const canSee = (u: any, d: { isApproved: boolean; authorId: number }) =>
  d.isApproved || isStaff(u) || (!!u && u.id === d.authorId);

function formatDemand(d: any, category?: any, neighborhood?: any, department?: any, isConfirmedByMe = false, attachments: AttachmentMeta[] = []) {
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
    authorId: d.authorId,
    authorName: d.authorName,
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
    if (search) conditions.push(ilike(demandsTable.title, `%${escapeLike(search)}%`));

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
      demands: demands.map(d => formatDemand(d, catMap[d.categoryId], nbrMap[d.neighborhoodId], undefined, confirmedIds.has(d.id), attachmentsByDemand.get(d.id))),
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
      demands: demands.map(d => formatDemand(d, catMap[d.categoryId], nbrMap[d.neighborhoodId], undefined, false, attachmentsByDemand.get(d.id))),
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
      title: text({ min: 5, max: 150 }),
      description: text({ min: 10, max: 5000 }),
      categoryId: int(),
      neighborhoodId: int(),
      address: text({ min: 5, max: 300 }),
      lat: serviceAreaLat(),
      lng: serviceAreaLng(),
      photoUrl: optional(httpUrl(), { blankAsMissing: true }),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { title, description, categoryId, neighborhoodId, address, lat, lng, photoUrl } = body.value;

    const [[category], [neighborhood]] = await Promise.all([
      db.select({ id: categoriesTable.id }).from(categoriesTable).where(eq(categoriesTable.id, categoryId)).limit(1),
      db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, neighborhoodId)).limit(1),
    ]);
    if (!category) return sendValidationError(res, { categoryId: "categoria não encontrada" });
    if (!neighborhood) return sendValidationError(res, { neighborhoodId: "bairro não encontrado" });

    // Equipe publica direto; cidadão entra na fila de moderação.
    const autoApproved = isStaff(currentUser);

    // Demanda + contadores + linha do tempo na mesma transação: ou tudo grava, ou nada.
    const demand = await db.transaction(async (tx) => {
      const [created] = await tx.insert(demandsTable).values({
        title, description, categoryId, neighborhoodId, address, lat, lng,
        photoUrl: photoUrl || null,
        authorId: currentUser.id,
        authorName: currentUser.name,
        status: "open",
        isApproved: autoApproved,
      }).returning();
      await tx.update(neighborhoodsTable).set({ demandsCount: sql`${neighborhoodsTable.demandsCount} + 1` }).where(eq(neighborhoodsTable.id, neighborhoodId));
      await tx.update(categoriesTable).set({ demandsCount: sql`${categoriesTable.demandsCount} + 1` }).where(eq(categoriesTable.id, categoryId));
      await tx.update(usersTable).set({ demandsCount: sql`${usersTable.demandsCount} + 1`, points: sql`${usersTable.points} + 10` }).where(eq(usersTable.id, currentUser.id));
      await tx.insert(timelineTable).values({ demandId: created.id, event: "Demanda criada", description: "Demanda registrada pelo cidadão", actorName: currentUser.name, actorRole: "citizen", statusTo: "open" });
      return created;
    });
    // O log de atividade (feed público) só sai quando a demanda é publicada.
    if (autoApproved) {
      await logActivity({ type: "demand_created", description: `Nova demanda: ${title}`, demandId: demand.id, demandTitle: title, actorName: currentUser.name, neighborhoodName: neighborhood?.name });
    }

    res.status(201).json(formatDemand(demand));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/demands/:id", optionalAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [demand] = await db.select().from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    const currentUser = (req as any).currentUser;
    if (!demand || !canSee(currentUser, demand)) { res.status(404).json({ error: "Not found" }); return; }

    let isConfirmedByMe = false;
    if (currentUser) {
      const [conf] = await db.select().from(confirmationsTable).where(and(eq(confirmationsTable.demandId, id), eq(confirmationsTable.userId, currentUser.id))).limit(1);
      isConfirmedByMe = !!conf;
    }

    const [categories, neighborhoods, departments, timeline, serviceOrders, attachmentsByDemand] = await Promise.all([
      db.select().from(categoriesTable).where(eq(categoriesTable.id, demand.categoryId)),
      db.select().from(neighborhoodsTable).where(eq(neighborhoodsTable.id, demand.neighborhoodId)),
      demand.departmentId ? db.select().from(departmentsTable).where(eq(departmentsTable.id, demand.departmentId)) : Promise.resolve([]),
      db.select().from(timelineTable).where(and(eq(timelineTable.demandId, id), eq(timelineTable.isPublic, true))).orderBy(timelineTable.createdAt),
      db.select().from(serviceOrdersTable).where(eq(serviceOrdersTable.demandId, id)),
      loadAttachmentMeta("demand", [id]),
    ]);

    const teamIds = [...new Set(serviceOrders.filter(o => o.teamId).map(o => o.teamId!))];
    const teams = teamIds.length ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)) : [];
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));

    res.json({
      ...formatDemand(demand, categories[0], neighborhoods[0], departments[0], isConfirmedByMe, attachmentsByDemand.get(id)),
      timeline: timeline.map(t => ({
        id: t.id, demandId: t.demandId, event: t.event, description: t.description,
        actorName: t.actorName, actorRole: t.actorRole, statusFrom: t.statusFrom,
        statusTo: t.statusTo, isPublic: t.isPublic, createdAt: t.createdAt.toISOString(),
      })),
      serviceOrders: serviceOrders.map(o => ({
        id: o.id, demandId: o.demandId, title: o.title, description: o.description,
        status: o.status, priority: o.priority, teamId: o.teamId,
        team: o.teamId ? teamMap[o.teamId] : undefined,
        estimatedCompletion: o.estimatedCompletion?.toISOString() ?? null,
        completedAt: o.completedAt?.toISOString() ?? null,
        slaHours: o.slaHours, notes: o.notes,
        createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
      })),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/demands/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const body = parseBody(req.body, {
      title: optional(text({ min: 5, max: 150 })),
      description: optional(text({ min: 10, max: 5000 })),
      priority: optional(nullable(oneOf(demandPriorityEnum.enumValues))),
      departmentId: optional(nullable(int())),
      publicResponse: optional(nullable(text({ min: 0, max: 2000 }))),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { title, description, priority, departmentId, publicResponse } = body.value;
    if (Object.keys(body.value).length === 0) {
      return sendValidationError(res, { body: "informe ao menos um campo para atualizar" });
    }
    if (departmentId) {
      const [dept] = await db.select({ id: departmentsTable.id }).from(departmentsTable).where(eq(departmentsTable.id, departmentId)).limit(1);
      if (!dept) return sendValidationError(res, { departmentId: "secretaria não encontrada" });
    }
    const demand = await db.transaction(async (tx) => {
      // Trava a demanda para ler a secretaria atual sem corrida com outra edição.
      const [existing] = await tx.select().from(demandsTable).where(eq(demandsTable.id, id)).limit(1).for("update");
      if (!existing) return null;
      const [updated] = await tx.update(demandsTable).set({
        ...(title !== undefined && { title }),
        ...(description !== undefined && { description }),
        ...(priority !== undefined && { priority }),
        ...(departmentId !== undefined && { departmentId }),
        ...(publicResponse !== undefined && { publicResponse }),
        updatedAt: new Date(),
      }).where(eq(demandsTable.id, id)).returning();
      // Mudou de secretaria: recalcula a antiga e a nova (total e resolvidas).
      if (departmentId !== undefined && departmentId !== existing.departmentId) {
        await syncDepartmentCounters(tx, [existing.departmentId, departmentId]);
      }
      return updated;
    });
    if (!demand) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatDemand(demand));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Aprova uma demanda pendente: passa a aparecer publicamente e entra no feed de atividade.
router.patch("/demands/:id/approve", requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const currentUser = (req as any).currentUser as { id: number; role: string; name: string };

    const result = await db.transaction(async (tx) => {
      const [existing] = await tx.select().from(demandsTable).where(eq(demandsTable.id, id)).limit(1).for("update");
      if (!existing) return null;
      if (existing.isApproved) return { existing, demand: existing, changed: false };
      const [updated] = await tx.update(demandsTable).set({ isApproved: true, updatedAt: new Date() }).where(eq(demandsTable.id, id)).returning();
      await tx.insert(timelineTable).values({
        demandId: id, event: "Demanda publicada", description: "Demanda aprovada para publicação",
        actorName: currentUser.name, actorRole: currentUser.role,
      });
      return { existing, demand: updated, changed: true };
    });
    if (!result) { res.status(404).json({ error: "Not found" }); return; }

    if (result.changed) {
      const [neighborhood] = await db.select({ name: neighborhoodsTable.name }).from(neighborhoodsTable).where(eq(neighborhoodsTable.id, result.existing.neighborhoodId)).limit(1);
      await logActivity({
        type: "demand_created", description: `Nova demanda: ${result.existing.title}`,
        demandId: id, demandTitle: result.existing.title,
        actorName: result.existing.authorName, neighborhoodName: neighborhood?.name,
      });
    }

    res.json(formatDemand(result.demand));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/demands/:id/timeline", optionalAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [demand] = await db.select({ isApproved: demandsTable.isApproved, authorId: demandsTable.authorId })
      .from(demandsTable).where(eq(demandsTable.id, id)).limit(1);
    if (!demand || !canSee((req as any).currentUser, demand)) { res.json([]); return; }
    const events = await db.select().from(timelineTable)
      .where(and(eq(timelineTable.demandId, id), eq(timelineTable.isPublic, true)))
      .orderBy(timelineTable.createdAt);
    res.json(events.map(t => ({
      id: t.id, demandId: t.demandId, event: t.event, description: t.description,
      actorName: t.actorName, actorRole: t.actorRole, statusFrom: t.statusFrom,
      statusTo: t.statusTo, isPublic: t.isPublic, createdAt: t.createdAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/demands/:id/status", requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const body = parseBody(req.body, {
      status: oneOf(demandStatusEnum.enumValues),
      note: optional(text({ min: 1, max: 1000 }), { blankAsMissing: true }),
      publicResponse: optional(nullable(text({ min: 0, max: 2000 }))),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { status, note, publicResponse } = body.value;
    const currentUser = (req as any).currentUser as { id: number; role: string; name: string };

    const result = await db.transaction(async (tx) => {
      // Trava a demanda: duas mudanças de status simultâneas se enfileiram em vez de se atropelarem.
      const [existing] = await tx.select().from(demandsTable).where(eq(demandsTable.id, id)).limit(1).for("update");
      if (!existing) return null;
      const [updated] = await tx.update(demandsTable).set({
        status,
        ...(publicResponse !== undefined && { publicResponse }),
        updatedAt: new Date(),
      }).where(eq(demandsTable.id, id)).returning();
      await tx.insert(timelineTable).values({
        demandId: id, event: `Status atualizado para: ${status}`,
        description: note || publicResponse || undefined,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        statusFrom: existing.status, statusTo: status,
      });
      // "Resolvidas" = demandas em `completed`. Só muda quando entra ou sai desse status, e é
      // recalculado (não somado), então completed -> completed e reabrir uma demanda não distorcem.
      const wasCompleted = existing.status === "completed";
      if (wasCompleted !== (status === "completed")) {
        await syncNeighborhoodCounters(tx, [existing.neighborhoodId]);
        await syncDepartmentCounters(tx, [existing.departmentId]);
      }
      return { existing, demand: updated, wasCompleted };
    });
    if (!result) { res.status(404).json({ error: "Not found" }); return; }
    const { existing, demand, wasCompleted } = result;

    const [neighborhood] = await db.select({ name: neighborhoodsTable.name }).from(neighborhoodsTable).where(eq(neighborhoodsTable.id, existing.neighborhoodId)).limit(1);
    const neighborhoodName = neighborhood?.name;
    if (status === "completed" && !wasCompleted) {
      await logActivity({ type: "demand_resolved", description: `Demanda resolvida: ${existing.title}`, demandId: id, demandTitle: existing.title, actorName: currentUser.name, neighborhoodName });
    } else {
      await logActivity({ type: "status_changed", description: `Status atualizado para ${status}: ${existing.title}`, demandId: id, demandTitle: existing.title, actorName: currentUser.name, neighborhoodName });
    }

    res.json(formatDemand(demand));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
