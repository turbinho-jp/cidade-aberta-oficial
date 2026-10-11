import { Router } from "express";
import { db, neighborhoodsTable } from "@workspace/db";
import { asc } from "drizzle-orm";

const router = Router();

router.get("/neighborhoods", async (req, res) => {
  try {
    const neighborhoods = await db.select().from(neighborhoodsTable).orderBy(asc(neighborhoodsTable.name));
    res.json(neighborhoods.map(n => ({ id: n.id, name: n.name, demandsCount: n.demandsCount, resolvedCount: n.resolvedCount })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
