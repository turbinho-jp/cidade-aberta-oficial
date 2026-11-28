import { createHash } from "crypto";
import { sql } from "drizzle-orm";
import { usersTable } from "@workspace/db";
import { ALLOWED_IMAGE_TYPES, sniffImageType, type ImageMime } from "./images";

/**
 * Foto de perfil. Fica em `users.avatar_url` como data URL (`data:image/jpeg;base64,...`), então não
 * precisa de migração. O que sai nas respostas da API NUNCA é o base64: é só o endereço leve
 * `/api/users/:id/avatar?v=<versão>`, que a rota de avatars (routes/avatars.ts) serve como imagem.
 * Assim ranking, comentários e /auth/me continuam pequenos e rápidos.
 */

/** Tamanho máximo da imagem (bytes). O navegador envia ~20–40 KB (256×256); o teto barra o resto. */
export const AVATAR_MAX_BYTES = 100_000;
/** Maior lado aceito, em pixels. */
export const AVATAR_MAX_SIDE = 1024;
/** Trocas de foto por pessoa por hora. */
export const AVATAR_UPLOADS_PER_HOUR = 10;

export function toAvatarDataUrl(type: ImageMime, data: Buffer): string {
  return `data:${type};base64,${data.toString("base64")}`;
}

const DATA_URL = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/]+={0,2})$/;

/**
 * Lê de volta o que foi gravado. Revalida tudo (formato do data URL e tipo real pelos primeiros
 * bytes): qualquer coisa que não seja JPEG/PNG/WebP, inclusive SVG ou URL externa, vira `null`.
 */
export function parseAvatarDataUrl(stored: string | null | undefined): { type: ImageMime; data: Buffer } | null {
  if (!stored) return null;
  const m = DATA_URL.exec(stored);
  if (!m) return null;
  const data = Buffer.from(m[2]!, "base64");
  const sniffed = sniffImageType(data);
  if (!sniffed || sniffed !== m[1] || !ALLOWED_IMAGE_TYPES.includes(sniffed)) return null;
  return { type: sniffed, data };
}

/** Versão do avatar para quebrar o cache do navegador quando a foto muda. Igual à de `avatarVersionSql`. */
export function avatarVersion(stored: string | null | undefined): string | null {
  return stored && stored.startsWith("data:") ? createHash("md5").update(stored).digest("hex").slice(0, 8) : null;
}

/** Mesma versão, calculada pelo banco, para listas (evita trazer o base64 de cada pessoa). */
export const avatarVersionSql = sql<string | null>`case when ${usersTable.avatarUrl} like 'data:%' then left(md5(${usersTable.avatarUrl}), 8) end`;

/** Endereço público do avatar, ou `null` se a pessoa não tem foto. */
export function avatarUrlFor(userId: number, version: string | null | undefined): string | null {
  return version ? `/api/users/${userId}/avatar?v=${version}` : null;
}

/** Atalho para quando a linha inteira do usuário já está em mãos. */
export function avatarUrlOf(user: { id: number; avatarUrl: string | null }): string | null {
  return avatarUrlFor(user.id, avatarVersion(user.avatarUrl));
}
