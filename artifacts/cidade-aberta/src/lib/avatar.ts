/** Foto de perfil: endereço, envio e remoção. A imagem vai crua no corpo (sem multipart). */

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

/** Endereço completo da foto devolvida pela API (`/api/users/7/avatar?v=ab12cd34`), ou undefined sem foto. */
export function avatarSrc(url: string | null | undefined): string | undefined {
  if (!url) return undefined;
  return url.startsWith("/") ? `${API_BASE}${url}` : url;
}

async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const body = await res.json();
    // Erros de validação trazem o motivo em `details` (ex.: "imagem grande demais").
    const first = body?.details && typeof body.details === "object" ? Object.values(body.details)[0] : null;
    if (typeof first === "string") return first;
    if (typeof body?.error === "string" && res.status !== 500) return body.error;
  } catch {
    /* resposta sem JSON */
  }
  return fallback;
}

export async function uploadMyAvatar(image: Blob): Promise<void> {
  const res = await fetch(`${API_BASE}/api/users/me/avatar`, {
    method: "PUT",
    credentials: "include",
    headers: { "Content-Type": image.type || "image/jpeg" },
    body: image,
  });
  if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível enviar a foto."));
}

/** A própria pessoa remove a sua foto; a equipe da prefeitura (moderação) remove a de qualquer uma. */
export async function removeAvatar(userId: number): Promise<void> {
  const res = await fetch(`${API_BASE}/api/users/${userId}/avatar`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await errorMessage(res, "Não foi possível remover a foto."));
}
