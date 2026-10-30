/** A API responde 403 com este código quando a conta ainda não confirmou o e-mail (apoiar, comentar, validar). */
export function isEmailNotVerified(err: unknown): boolean {
  const e = err as { status?: number; data?: { code?: string } | null } | null;
  return e?.status === 403 && e?.data?.code === "EMAIL_NOT_VERIFIED";
}

export const EMAIL_NOT_VERIFIED_TOAST = {
  title: "Confirme seu e-mail primeiro",
  description: "Enviamos um link para o seu e-mail. Depois de confirmar, você pode apoiar, comentar e validar resoluções. Use a faixa no topo do site para reenviar o link.",
  variant: "destructive" as const,
};
