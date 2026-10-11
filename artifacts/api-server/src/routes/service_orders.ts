import { Router } from "express";
import { db, serviceOrdersTable, teamsTable, demandsTable, timelineTable, serviceOrderStatusEnum, serviceOrderPriorityEnum } from "@workspace/db";
import { eq, and, inArray } from "drizzle-orm";
import { requireAdmin } from "../lib/auth";
import { logActivity } from "../lib/activity";
import { syncTeamCounters } from "../lib/counters";
import {
  parseBody, parseQuery, parseId, sendValidationError, paginationFields,
  text, int, oneOf, isoDate, optional, nullable,
} from "../lib/validate";

const router = Router();

function formatOrder(o: any, team?: any, demand?: any) {
  return {
    id: o.id, demandId: o.demandId, demand: demand || undefined,
    title: o.title, description: o.description, status: o.status, priority: o.priority,
    teamId: o.teamId, team: team || undefined,
    estimatedCompletion: o.estimatedCompletion?.toISOString() ?? null,
    completedAt: o.completedAt?.toISOString() ?? null,
    slaHours: o.slaHours, notes: o.notes,
    createdAt: o.createdAt.toISOString(), updatedAt: o.updatedAt.toISOString(),
  };
}

router.get("/service-orders", async (req, res) => {
  try {
    const q = parseQuery(req.query, {
      status: optional(oneOf(serviceOrderStatusEnum.enumValues), { blankAsMissing: true }),
      teamId: optional(int(), { blankAsMissing: true }),
      demandId: optional(int(), { blankAsMissing: true }),
      ...paginationFields(200),
    });
    if (!q.ok) return sendValidationError(res, q.errors);
    const { status, teamId, demandId } = q.value;
    const limit = q.value.limit ?? 20;
    const offset = q.value.offset ?? 0;
    const conditions: any[] = [];
    if (status) conditions.push(eq(serviceOrdersTable.status, status));
    if (teamId) conditions.push(eq(serviceOrdersTable.teamId, teamId));
    if (demandId) conditions.push(eq(serviceOrdersTable.demandId, demandId));
    const where = conditions.length ? and(...conditions) : undefined;
    const orders = await db.select().from(serviceOrdersTable).where(where)
      .orderBy(serviceOrdersTable.createdAt).limit(limit).offset(offset);
    const teamIds = [...new Set(orders.filter(o => o.teamId).map(o => o.teamId!))];
    const teams = teamIds.length ? await db.select().from(teamsTable).where(inArray(teamsTable.id, teamIds)) : [];
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t]));
    res.json(orders.map(o => formatOrder(o, o.teamId ? teamMap[o.teamId] : undefined)));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/service-orders", requireAdmin, async (req, res) => {
  try {
    const body = parseBody(req.body, {
      demandId: int(),
      title: text({ min: 3, max: 150 }),
      description: optional(nullable(text({ min: 0, max: 2000 }))),
      priority: oneOf(serviceOrderPriorityEnum.enumValues),
      teamId: optional(nullable(int())),
      estimatedCompletion: optional(nullable(isoDate())),
      slaHours: optional(nullable(int({ min: 1, max: 8760 }))),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { demandId, title, description, priority, teamId, estimatedCompletion, slaHours } = body.value;
    const currentUser = (req as any).currentUser as { id: number; role: string; name: string };

    const [target] = await db.select({ id: demandsTable.id, title: demandsTable.title }).from(demandsTable).where(eq(demandsTable.id, demandId)).limit(1);
    if (!target) return sendValidationError(res, { demandId: "demanda não encontrada" });
    if (teamId) {
      const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
      if (!team) return sendValidationError(res, { teamId: "equipe não encontrada" });
    }
    const order = await db.transaction(async (tx) => {
      const [created] = await tx.insert(serviceOrdersTable).values({
        demandId, title, description: description || null, priority,
        teamId: teamId || null,
        estimatedCompletion: estimatedCompletion ?? null,
        slaHours: slaHours || null,
        status: teamId ? "assigned" : "pending",
      }).returning();
      await tx.insert(timelineTable).values({ demandId, event: "Ordem de serviço criada", description: title, actorName: currentUser.name, actorRole: currentUser.role });
      // Criar a OS só "aprova" demandas ainda em triagem. Antes ela rebaixava qualquer demanda
      // (inclusive concluída) para `approved`, o que desfazia o resultado sem ajustar os contadores.
      await tx.update(demandsTable).set({ status: "approved", updatedAt: new Date() })
        .where(and(eq(demandsTable.id, demandId), inArray(demandsTable.status, ["open", "under_review"])));
      await syncTeamCounters(tx, [created.teamId]);
      return created;
    });
    await logActivity({ type: "service_order_created", description: `OS criada: ${title}`, demandId, demandTitle: target.title, actorName: currentUser.name });

    res.status(201).json(formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/service-orders/:id", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [order] = await db.select().from(serviceOrdersTable).where(eq(serviceOrdersTable.id, id)).limit(1);
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    const team = order.teamId ? (await db.select().from(teamsTable).where(eq(teamsTable.id, order.teamId)).limit(1))[0] : undefined;
    res.json(formatOrder(order, team));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.patch("/service-orders/:id", requireAdmin, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const body = parseBody(req.body, {
      status: optional(oneOf(serviceOrderStatusEnum.enumValues)),
      teamId: optional(nullable(int())),
      notes: optional(nullable(text({ min: 0, max: 2000 }))),
      completedAt: optional(nullable(isoDate())),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { status, teamId, notes, completedAt } = body.value;
    if (Object.keys(body.value).length === 0) {
      return sendValidationError(res, { body: "informe ao menos um campo para atualizar" });
    }
    if (teamId) {
      const [team] = await db.select({ id: teamsTable.id }).from(teamsTable).where(eq(teamsTable.id, teamId)).limit(1);
      if (!team) return sendValidationError(res, { teamId: "equipe não encontrada" });
    }
    const order = await db.transaction(async (tx) => {
      const [existing] = await tx.select({ teamId: serviceOrdersTable.teamId }).from(serviceOrdersTable)
        .where(eq(serviceOrdersTable.id, id)).limit(1).for("update");
      if (!existing) return null;
      const [updated] = await tx.update(serviceOrdersTable).set({
        ...(status && { status }),
        ...(teamId !== undefined && { teamId: teamId || null }),
        ...(notes !== undefined && { notes }),
        ...(completedAt && { completedAt }),
        updatedAt: new Date(),
      }).where(eq(serviceOrdersTable.id, id)).returning();
      // Mudança de status e/ou de equipe: recalcula a equipe antiga e a nova.
      await syncTeamCounters(tx, [existing.teamId, updated.teamId]);
      return updated;
    });
    if (!order) { res.status(404).json({ error: "Not found" }); return; }
    res.json(formatOrder(order));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
