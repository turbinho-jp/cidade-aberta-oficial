import { Router, type Request } from "express";
import { createHash, randomBytes } from "crypto";
import { db, usersTable, emailVerificationTokensTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";
import { hashPassword, verifyPassword, setAuthCookie, clearAuthCookie, getUserFromCookie, requireAuth } from "../lib/auth";
import { isLoginBlocked, recordLoginFailure, registerAttemptBlocked, verificationResendBlocked } from "../lib/rate-limit";
import { sendVerificationEmail } from "../lib/mailer";
import { parseBody, sendValidationError, text, email, optional } from "../lib/validate";

const router = Router();

// `trust proxy` está ligado em app.ts, então req.ip é o IP do cliente atrás da Vercel.
const clientIp = (req: Request) => req.ip || "unknown";

/** O link de confirmação vale por 24 horas. */
const VERIFICATION_TTL_HOURS = 24;
const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");

/**
 * Gera um link novo (apagando os anteriores da pessoa) e envia por e-mail. Só o hash do token fica no
 * banco. A validade é calculada pelo relógio do banco (como em rate-limit.ts), não pelo do Node.
 * Devolve true se o servidor de e-mail aceitou a mensagem.
 */
async function issueVerificationEmail(user: { id: number; name: string; email: string }): Promise<boolean> {
  const token = randomBytes(32).toString("base64url");
  await db.transaction(async (tx) => {
    await tx.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, user.id));
    await tx.insert(emailVerificationTokensTable).values({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: sql`now() + make_interval(hours => ${VERIFICATION_TTL_HOURS})`,
    });
  });
  return sendVerificationEmail(user.email, user.name, token);
}

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
    // Se o envio falhar a conta já existe: a pessoa pede o reenvio pela faixa de aviso do site.
    await issueVerificationEmail(user).catch((err) => req.log.error(err));
    setAuthCookie(res, { id: user.id, role: user.role, name: user.name });
    res.status(201).json({
      user: {
        id: user.id, name: user.name, email: user.email, role: user.role,
        phone: user.phone, avatarUrl: user.avatarUrl, points: user.points,
        demandsCount: user.demandsCount, confirmationsCount: user.confirmationsCount,
        commentsCount: user.commentsCount, emailVerified: !!user.emailVerifiedAt, createdAt: user.createdAt.toISOString(),
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
        commentsCount: user.commentsCount, emailVerified: !!user.emailVerifiedAt, createdAt: user.createdAt.toISOString(),
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
      commentsCount: user.commentsCount, emailVerified: !!user.emailVerifiedAt, createdAt: user.createdAt.toISOString(),
    });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Confirma o e-mail pelo link. Pública de propósito: a pessoa costuma abrir o link no celular, sem
// sessão. O token é de uso único (apagado aqui) e a resposta distingue expirado de inválido.
router.post("/auth/verify-email", async (req, res) => {
  try {
    const body = parseBody(req.body, { token: text({ min: 20, max: 200 }) });
    if (!body.ok) return sendValidationError(res, body.errors);

    const outcome = await db.transaction(async (tx) => {
      const [found] = await tx.delete(emailVerificationTokensTable)
        .where(eq(emailVerificationTokensTable.tokenHash, hashToken(body.value.token)))
        .returning({
          userId: emailVerificationTokensTable.userId,
          valid: sql<boolean>`${emailVerificationTokensTable.expiresAt} > now()`,
        });
      if (!found) return "invalid" as const;
      if (!found.valid) return "expired" as const;
      await tx.update(usersTable).set({ emailVerifiedAt: sql`now()` })
        .where(and(eq(usersTable.id, found.userId), sql`${usersTable.emailVerifiedAt} IS NULL`));
      // Qualquer outro link pendente da pessoa deixa de ser necessário.
      await tx.delete(emailVerificationTokensTable).where(eq(emailVerificationTokensTable.userId, found.userId));
      return "ok" as const;
    });

    if (outcome === "ok") { res.json({ verified: true }); return; }
    if (outcome === "expired") { res.status(410).json({ error: "Link expired", code: "TOKEN_EXPIRED" }); return; }
    res.status(400).json({ error: "Invalid link", code: "TOKEN_INVALID" });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/auth/resend-verification", requireAuth, async (req, res) => {
  try {
    const currentUser = (req as any).currentUser;
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, currentUser.id)).limit(1);
    if (!user) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (user.emailVerifiedAt) { res.json({ sent: false, alreadyVerified: true }); return; }

    if (await verificationResendBlocked(user.id)) {
      res.setHeader("Retry-After", "3600");
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    const sent = await issueVerificationEmail(user);
    if (!sent) { res.status(503).json({ error: "Email delivery failed" }); return; }
    res.json({ sent: true, alreadyVerified: false });
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
