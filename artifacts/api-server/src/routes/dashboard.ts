import { Router } from "express";
import { db, demandsTable, usersTable, activityLogTable } from "@workspace/db";
import { sql, desc, eq, or, isNull } from "drizzle-orm";
import { parseQuery, sendValidationError, paginationFields } from "../lib/validate";
import { publicName } from "../lib/public-name";

const router = Router();

// Tudo aqui é PÚBLICO, então só considera demandas aprovadas (is_approved = true) e calcula os
// números a partir das linhas reais. Nada de valores fixos: quando não há dado, devolve null.

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
    }).from(demandsTable).where(eq(demandsTable.isApproved, true));

    const [userCount] = await db.select({ total: sql<number>`count(*)::int` }).from(usersTable);

    // Tempo até a 1ª resposta da equipe (qualquer evento de admin/secretário/moderador, exceto
    // a simples publicação da demanda) e tempo até a conclusão (1º evento "completed"), em dias.
    const averages = await db.execute<{ avg_response_days: number | null; avg_resolution_days: number | null }>(sql`
      select
        (select avg(extract(epoch from (r.first_at - d.created_at)) / 86400.0)::float8
           from demands d
           join lateral (
             select min(t.created_at) as first_at from timeline_events t
              where t.demand_id = d.id
                and t.actor_role in ('admin', 'secretary', 'moderator')
                and t.event <> 'Demanda publicada'
           ) r on r.first_at is not null
          where d.is_approved) as avg_response_days,
        (select avg(extract(epoch from (c.done_at - d.created_at)) / 86400.0)::float8
           from demands d
           join lateral (
             select min(t.created_at) as done_at from timeline_events t
              where t.demand_id = d.id and t.status_to = 'completed'
           ) c on c.done_at is not null
          where d.is_approved and d.status = 'completed') as avg_resolution_days
    `);
    const avg = averages.rows[0];
    const round1 = (n: number | null | undefined) => (n == null ? null : Math.round(Number(n) * 10) / 10);

    const total = totals.totalDemands || 0;
    const resolved = totals.resolvedDemands || 0;

    res.json({
      totalDemands: total,
      openDemands: totals.openDemands || 0,
      inProgressDemands: totals.inProgressDemands || 0,
      resolvedDemands: resolved,
      rejectedDemands: totals.rejectedDemands || 0,
      totalCitizens: userCount.total || 0,
      avgResponseDays: round1(avg?.avg_response_days),
      avgResolutionDays: round1(avg?.avg_resolution_days),
      totalConfirmations: totals.totalConfirmations || 0,
      totalComments: totals.totalComments || 0,
      resolutionRate: total > 0 ? Math.round((resolved / total) * 100) : 0,
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Calculado direto das demandas aprovadas (os contadores denormalizados de bairro incluem pendentes).
// Só lista bairros com pelo menos uma demanda.
router.get("/dashboard/by-neighborhood", async (req, res) => {
  try {
    const rows = await db.execute<{
      neighborhoodId: number; neighborhoodName: string; totalDemands: number; resolved: number; inProgress: number;
    }>(sql`
      select n.id as "neighborhoodId", n.name as "neighborhoodName",
             count(d.id)::int as "totalDemands",
             (count(d.id) filter (where d.status = 'completed'))::int as "resolved",
             (count(d.id) filter (where d.status in ('open', 'under_review', 'approved', 'in_progress')))::int as "inProgress"
        from neighborhoods n
        join demands d on d.neighborhood_id = n.id and d.is_approved
       group by n.id, n.name
       order by count(d.id) desc, n.name
       limit 10
    `);
    res.json(rows.rows.map(r => ({ ...r, avgResolutionDays: null })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/by-category", async (req, res) => {
  try {
    const rows = await db.execute<{
      categoryId: number; categoryName: string; categoryIcon: string; categoryColor: string; totalDemands: number; resolved: number;
    }>(sql`
      select c.id as "categoryId", c.name as "categoryName", c.icon as "categoryIcon", c.color as "categoryColor",
             count(d.id)::int as "totalDemands",
             (count(d.id) filter (where d.status = 'completed'))::int as "resolved"
        from categories c
        left join demands d on d.category_id = c.id and d.is_approved
       group by c.id, c.name, c.icon, c.color
       order by count(d.id) desc, c.name
    `);
    res.json(rows.rows);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/dashboard/recent-activity", async (req, res) => {
  try {
    const q = parseQuery(req.query, { limit: paginationFields(100).limit });
    if (!q.ok) return sendValidationError(res, q.errors);
    // Feed público: confere a aprovação NA LEITURA. Eventos gravados quando a demanda estava
    // aprovada somem do feed se ela for reprovada depois. Evento sem demanda ligada continua visível.
    const rows = await db.select({ event: activityLogTable })
      .from(activityLogTable)
      .leftJoin(demandsTable, eq(demandsTable.id, activityLogTable.demandId))
      .where(or(isNull(activityLogTable.demandId), eq(demandsTable.isApproved, true)))
      .orderBy(desc(activityLogTable.createdAt)).limit(q.value.limit ?? 20);
    const events = rows.map(r => r.event);
    res.json(events.map(e => ({
      id: e.id, type: e.type, description: e.description,
      demandId: e.demandId, demandTitle: e.demandTitle,
      actorName: e.actorName ? publicName(e.actorName) : e.actorName, neighborhoodName: e.neighborhoodName,
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
      .where(eq(demandsTable.isApproved, true))
      .orderBy(desc(demandsTable.confirmationsCount)).limit(10);
    res.json(demands.map(d => ({
      id: d.id, title: d.title, description: d.description, status: d.status, priority: d.priority,
      categoryId: d.categoryId, neighborhoodId: d.neighborhoodId,
      address: d.address, lat: d.lat, lng: d.lng, photoUrl: d.photoUrl,
      confirmationsCount: d.confirmationsCount, commentsCount: d.commentsCount,
      isConfirmedByMe: false, authorId: d.authorId, authorName: publicName(d.authorName),
      publicResponse: d.publicResponse, createdAt: d.createdAt.toISOString(), updatedAt: d.updatedAt.toISOString(),
    })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
