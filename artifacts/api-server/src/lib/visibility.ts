import { demandsTable } from "@workspace/db";
import { eq, or } from "drizzle-orm";

/** Quem aparece em `req.currentUser` (ou null para anônimo). */
export type Viewer = { id: number; role: string } | null | undefined;

/** Gestão da prefeitura (admin/secretário): enxerga todas as demandas, inclusive as pendentes. */
export const isManager = (u: Viewer) => !!u && (u.role === "admin" || u.role === "secretary");

/**
 * Filtro SQL de moderação: demanda pendente (is_approved = false) só é visível ao autor e à gestão.
 * Retorna `undefined` para a gestão (sem filtro); `and(...)` do drizzle ignora `undefined`.
 */
export const visibleTo = (u: Viewer) =>
  isManager(u)
    ? undefined
    : u
      ? or(eq(demandsTable.isApproved, true), eq(demandsTable.authorId, u.id))
      : eq(demandsTable.isApproved, true);

/** Mesma regra de `visibleTo`, para uma demanda já carregada. */
export const canSee = (u: Viewer, d: { isApproved: boolean; authorId: number }) =>
  d.isApproved || isManager(u) || (!!u && u.id === d.authorId);
