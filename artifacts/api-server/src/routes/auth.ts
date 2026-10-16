import { Router, type Request } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, setAuthCookie, clearAuthCookie, getUserFromCookie } from "../lib/auth";
import { isLoginBlocked, recordLoginFailure, registerAttemptBlocked } from "../lib/rate-limit";
import { parseBody, sendValidationError, text, email, optional } from "../lib/validate";

const router = Router();

// `trust proxy` está ligado em app.ts, então req.ip é o IP do cliente atrás da Vercel.
const clientIp = (req: Request) => req.ip || "unknown";

router.post("/auth/register", async (req, res) => {
  try {
    const body = parseBody(req.body, {
      name: text({ min: 2, max: 100 }),
      email: email(),
      password: text({ min: 8, max: 128, trim: false }),
      phone: optional(text({ min: 3, max: 30 }), { blankAsMissing: true }),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { name, email: userEmail, password, phone } = body.value;

    if (await registerAttemptBlocked(clientIp(req))) {
      res.setHeader("Retry-After", "3600");
      res.status(429).json({ error: "Too many requests" });
      return;
    }

    const existing = await db.select({ id: usersTable.id }).from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${userEmail}`).limit(1);
    if (existing.length > 0) {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    const passwordHash = await hashPassword(password);
    const [user] = await db.insert(usersTable).values({
      name,
      email: userEmail,
      passwordHash,
      phone: phone || null,
      role: "citizen",
    }).returning();
    setAuthCookie(res, { id: user.id, role: user.role, name: user.name });
    res.status(201).json({
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone, avatarUrl: user.avatarUrl, points: user.points,
        demandsCount: user.demandsCount, confirmationsCount: user.confirmationsCount,
        commentsCount: user.commentsCount, createdAt: user.createdAt.toISOString(),
      }
    });
  } catch (err: any) {
    // Corrida entre dois cadastros com o mesmo e-mail: violação de UNIQUE.
    if (err?.code === "23505" || err?.cause?.code === "23505") {
      res.status(400).json({ error: "Email already registered" });
      return;
    }
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/login", async (req, res) => {
  try {
    const body = parseBody(req.body, {
      email: email(),
      password: text({ min: 1, max: 128, trim: false }),
    });
    if (!body.ok) return sendValidationError(res, body.errors);
    const { email: userEmail, password } = body.value;
    const ip = clientIp(req);
    if (await isLoginBlocked(userEmail, ip)) {
      res.setHeader("Retry-After", "900");
      res.status(429).json({ error: "Too many attempts" });
      return;
    }
    const [user] = await db.select().from(usersTable)
      .where(sql`lower(${usersTable.email}) = ${userEmail}`).limit(1);
    const check = await verifyPassword(password, user?.passwordHash);
    if (!user || !check.ok) {
      await recordLoginFailure(userEmail, ip);
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    // Senha ainda no formato antigo (SHA-256 com salt fixo): regrava em scrypt agora que ela é conhecida.
    if (check.needsRehash) {
      await db.update(usersTable).set({ passwordHash: await hashPassword(password) }).where(eq(usersTable.id, user.id));
    }
    setAuthCookie(res, { id: user.id, role: user.role, name: user.name });
    res.json({
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone, avatarUrl: user.avatarUrl, points: user.points,
        demandsCount: user.demandsCount, confirmationsCount: user.confirmationsCount,
        commentsCount: user.commentsCount, createdAt: user.createdAt.toISOString(),
      }
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/auth/me", async (req, res) => {
  try {
    const userInfo = getUserFromCookie(req);
    if (!userInfo) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, userInfo.id)).limit(1);
    if (!user) {
      res.status(401).json({ error: "User not found" });
      return;
    }
    res.json({
      id: user.id, name: user.name, email: user.email, role: user.role,
      phone: user.phone, avatarUrl: user.avatarUrl, points: user.points,
      demandsCount: user.demandsCount, confirmationsCount: user.confirmationsCount,
      commentsCount: user.commentsCount, createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/logout", (req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

export default router;
