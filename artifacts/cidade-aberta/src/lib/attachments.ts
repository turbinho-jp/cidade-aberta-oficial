/** Envio de fotos: o corpo da requisição é a imagem crua (sem multipart). */
import type { Attachment } from "@workspace/api-client-react";

const API_BASE = ((import.meta.env.VITE_API_URL as string | undefined) ?? "").replace(/\/+$/, "");

/** Endereço completo de uma imagem devolvida pela API (`/api/attachments/12`). */
export function attachmentSrc(url: string): string {
  return `${API_BASE}${url}`;
}

export type AttachmentTarget = "demand" | "public-work";

export async function uploadAttachment(target: AttachmentTarget, id: number, image: Blob): Promise<Attachment> {
  const path = target === "demand" ? "demands" : "public-works";
  const res = await fetch(`${API_BASE}/api/${path}/${id}/attachments`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": image.type || "image/jpeg" },
    body: image,
  });
  if (!res.ok) {
    let message = "Não foi possível enviar a foto.";
    try {
      const body = await res.json();
      if (typeof body?.error === "string" && res.status !== 500) message = body.error;
    } catch {
      /* resposta sem JSON */
    }
    throw new Error(message);
  }
  return res.json();
}

/** Primeira foto de um item: o anexo enviado ou, em registros antigos, a URL externa. */
export function coverUrl(item: { attachments?: Attachment[]; photoUrl?: string | null }): string | null {
  const first = item.attachments?.[0];
  if (first) return attachmentSrc(first.url);
  return item.photoUrl || null;
}
