import { Router } from "express";
import { db, categoriesTable } from "@workspace/db";
import { requireAdmin } from "../lib/auth";
import { parseBody, sendValidationError, text, optional, nullable } from "../lib/validate";

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;
const colorField = {
  optional: false,
  parse(v: unknown) {
    return typeof v === "string" && HEX_COLOR.test(v)
      ? { ok: true as const, value: v }
      : { ok: false as const, error: "deve ser uma cor hexadecimal (#RRGGBB)" };
  },
};

const router = Router();

router.get("/categories", async (req, res) => {
  try {
    const categories = await db.select().from(categoriesTable).orderBy(categoriesTable.name);
    res.json(categories.map(c => ({ id: c.id, name: c.name, icon: c.icon, color: c.color, description: c.description, demandsCount: c.demandsCount })));
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/categories", requireAdmin, async (req, res) => {
  try {
    const body = parseBody(req.body, {
      name: text({ min: 2, max: 80 }),
      icon: text({ min: 1, max: 50 }),
      color: colorField,
      description: optional(nullable(text({ min: 0, max: 300 }))),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { name, icon, color, description } = body.value;
    const [cat] = await db.insert(categoriesTable).values({ name, icon, color, description: description || null }).returning();
    res.status(201).json({ id: cat.id, name: cat.name, icon: cat.icon, color: cat.color, description: cat.description, demandsCount: cat.demandsCount });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
