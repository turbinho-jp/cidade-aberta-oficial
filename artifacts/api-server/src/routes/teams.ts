import { Router } from "express";
import { db, teamsTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { parseBody, sendValidationError, text, optional, nullable } from "../lib/validate";

const router = Router();

router.get("/teams", async (req, res) => {
  try {
    const teams = await db.select().from(teamsTable).orderBy(teamsTable.name);
    res.json(teams.map(t => ({ id: t.id, name: t.name, area: t.area, description: t.description, activeOrdersCount: t.activeOrdersCount, completedOrdersCount: t.completedOrdersCount })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/teams", requireAdmin, async (req, res) => {
  try {
    const body = parseBody(req.body, {
      name: text({ min: 2, max: 100 }),
      area: text({ min: 2, max: 100 }),
      description: optional(nullable(text({ min: 0, max: 500 }))),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { name, area, description } = body.value;
    const [team] = await db.insert(teamsTable).values({ name, area, description: description || null }).returning();
    res.status(201).json({ id: team.id, name: team.name, area: team.area, description: team.description, activeOrdersCount: 0, completedOrdersCount: 0 });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
