import { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createHash } from "crypto";

export const AUTH_COOKIE = "auth";

const ROLES = ["citizen", "admin", "secretary", "moderator"] as const;
export type Role = (typeof ROLES)[number];

export interface SessionUser {
  id: number;
  role: Role;
  name: string;
}

/** Quem gere demandas, ordens de serviço, equipes, categorias e obras. */
const MANAGEMENT_ROLES: readonly Role[] = ["admin", "secretary"];
/** Equipe da prefeitura em geral; inclui o moderador (que só modera comentários). */
export const STAFF_ROLES: readonly Role[] = ["admin", "secretary", "moderator"];

export function isStaff(role: string): boolean {
  return (STAFF_ROLES as readonly string[]).includes(role);
}

/**
 * Segredo usado para assinar o cookie de sessão. É obrigatório: se não estiver
 * definido (ou for curto demais) o servidor se recusa a iniciar, em vez de
 * cair num valor padrão conhecido publicamente.
 * Gere um com: openssl rand -hex 32
 */
export function getSessionSecret(): string {
  const secret = process.env["SESSION_SECRET"];
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "SESSION_SECRET não definido ou curto demais (mínimo 16 caracteres). " +
        "Defina a variável de ambiente, por exemplo com: openssl rand -hex 32",
    );
  }
  return secret;
}

export function hashPassword(password: string): string {
  return createHash("sha256").update(password + "cidade-aberta-salt").digest("hex");
}

/**
 * Lê a sessão do cookie ASSINADO. Se a assinatura for inválida, o
 * cookie-parser entrega `false` em `signedCookies` e a sessão é ignorada;
 * cookies comuns (não assinados, forjáveis) nunca são aceitos.
 * Esta função só confia na assinatura; os middlewares abaixo confirmam o
 * usuário e o papel atual no banco.
 */
export function getUserFromCookie(req: Request): SessionUser | null {
  try {
    const token: unknown = req.signedCookies?.[AUTH_COOKIE];
    if (typeof token !== "string" || token.length === 0) return null;
    const parsed: unknown = JSON.parse(Buffer.from(token, "base64").toString("utf8"));
    if (parsed === null || typeof parsed !== "object") return null;
    const { id, role, name } = parsed as Record<string, unknown>;
    if (typeof id !== "number" || !Number.isInteger(id) || id <= 0) return null;
    if (typeof name !== "string") return null;
    if (typeof role !== "string" || !(ROLES as readonly string[]).includes(role)) return null;
    return { id, role: role as Role, name };
  } catch {
    return null;
  }
}

export function setAuthCookie(res: Response, user: SessionUser) {
  const token = Buffer.from(JSON.stringify({ id: user.id, role: user.role, name: user.name })).toString("base64");
  res.cookie(AUTH_COOKIE, token, {
    signed: true,
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env["NODE_ENV"] === "production",
    path: "/",
  });
}

/**
 * Sessão assinada + usuário atual no banco. Usar o banco garante que um
 * usuário removido ou rebaixado perde o acesso imediatamente, sem esperar o
 * cookie expirar, e que o papel nunca vem só do cookie.
 */
async function loadCurrentUser(req: Request): Promise<SessionUser | null> {
  const session = getUserFromCookie(req);
  if (!session) return null;
  const [user] = await db
    .select({ id: usersTable.id, role: usersTable.role, name: usersTable.name })
    .from(usersTable)
    .where(eq(usersTable.id, session.id))
    .limit(1);
  return user ? { id: user.id, role: user.role, name: user.name } : null;
}

/** Exige usuário autenticado (401 caso contrário). */
export async function requireAuth(req: Request, res: Response, next: NextFunction) {
  try {
    const user = await loadCurrentUser(req);
    if (!user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    (req as any).currentUser = user;
    next();
  } catch (err) {
    req.log?.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
}

/** Exige um dos papéis informados: 401 sem sessão, 403 com papel insuficiente. */
export function requireRole(...roles: readonly Role[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const user = await loadCurrentUser(req);
      if (!user) {
        res.status(401).json({ error: "Unauthorized" });
        return;
      }
      if (!roles.includes(user.role)) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
      (req as any).currentUser = user;
      next();
    } catch (err) {
      req.log?.error(err);
      res.status(500).json({ error: "Internal server error" });
    }
  };
}

/** Gestão da prefeitura: administrador ou secretário. */
export const requireAdmin = requireRole(...MANAGEMENT_ROLES);

/** Equipe da prefeitura, incluindo moderadores. */
export const requireStaff = requireRole(...STAFF_ROLES);

/** Preenche `req.currentUser` quando há sessão válida, sem bloquear anônimos. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  (req as any).currentUser = getUserFromCookie(req);
  next();
}
