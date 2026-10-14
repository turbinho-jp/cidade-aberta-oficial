/**
 * Fotos/anexos (Etapa 5), guardados no PostgreSQL.
 *
 *   POST   /api/demands/:id/attachments        corpo = bytes da imagem (Content-Type image/*)
 *   POST   /api/public-works/:id/attachments   idem (apenas gestão)
 *   GET    /api/attachments/:id                devolve a imagem (cache longo, imutável)
 *   DELETE /api/attachments/:id                autor/quem enviou ou gestão
 *
 * Sem multipart, sem multer, sem SDK: o corpo é a imagem crua (express.raw).
 * O navegador já reduz a foto antes de enviar (ver lib/image-compress.ts no frontend).
 */
import express, { Router } from "express";
import { db, attachmentsTable, demandsTable, publicWorksTable } from "@workspace/db";
import { and, eq, gt, inArray, sql } from "drizzle-orm";
import { requireAuth, requireAdmin, optionalAuth, type SessionUser } from "../lib/auth";
import { canSee } from "../lib/visibility";
import { parseId, sendValidationError } from "../lib/validate";
import { ALLOWED_IMAGE_TYPES, sniffImageType, stripJpegMetadata } from "../lib/images";

const router = Router();

function envInt(name: string, fallback: number): number {
  const n = Number(process.env[name]);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

/** Tamanho máximo de UMA foto, em bytes (o navegador envia ~200–600 KB). */
const MAX_FILE_BYTES = envInt("MAX_ATTACHMENT_BYTES", 1_000_000);
/** Fotos por demanda / obra. */
const MAX_PER_ENTITY = envInt("MAX_ATTACHMENTS_PER_ITEM", 5);
/** Envios por usuário na última hora (contenção de abuso). */
const MAX_UPLOADS_PER_HOUR = envInt("MAX_UPLOADS_PER_HOUR", 30);
/** Teto de armazenamento de fotos no banco. O plano grátis do Neon/Supabase tem ~500 MB. */
const MAX_TOTAL_BYTES = envInt("MAX_ATTACHMENTS_TOTAL_BYTES", 350_000_000);

const rawImage = express.raw({ type: [...ALLOWED_IMAGE_TYPES], limit: MAX_FILE_BYTES });

/** Metadados (nunca `data`) dos anexos de uma lista de demandas/obras. */
export type AttachmentMeta = { id: number; url: string; mimeType: string; sizeBytes: number };

export async function loadAttachmentMeta(
  kind: "demand" | "publicWork",
  ids: number[],
): Promise<Map<number, AttachmentMeta[]>> {
  const map = new Map<number, AttachmentMeta[]>();
  if (ids.length === 0) return map;
  const ownerCol = kind === "demand" ? attachmentsTable.demandId : attachmentsTable.publicWorkId;
  const rows = await db
    .select({
      id: attachmentsTable.id,
      owner: ownerCol,
      mimeType: attachmentsTable.mimeType,
      sizeBytes: attachmentsTable.sizeBytes,
    })
    .from(attachmentsTable)
    .where(inArray(ownerCol, ids))
    .orderBy(attachmentsTable.id);
  for (const r of rows) {
    const list = map.get(r.owner!) ?? [];
    list.push({ id: r.id, url: `/api/attachments/${r.id}`, mimeType: r.mimeType, sizeBytes: r.sizeBytes });
    map.set(r.owner!, list);
  }
  return map;
}

async function saveAttachment(
  req: express.Request,
  res: express.Response,
  owner: { kind: "demand" | "publicWork"; id: number },
) {
  const user = (req as any).currentUser as SessionUser;
  const body: unknown = req.body;
  if (!Buffer.isBuffer(body) || body.length === 0) {
    res.status(415).json({ error: "Envie a imagem como corpo da requisição (image/jpeg, image/png ou image/webp)." });
    return;
  }
  const type = sniffImageType(body);
  if (!type) {
    sendValidationError(res, { file: "arquivo não é uma imagem JPEG, PNG ou WebP válida" });
    return;
  }
  const data = type === "image/jpeg" ? stripJpegMetadata(body) : body;
  if (!data) {
    sendValidationError(res, { file: "imagem JPEG corrompida" });
    return;
  }

  const ownerCol = owner.kind === "demand" ? attachmentsTable.demandId : attachmentsTable.publicWorkId;
  const created = await db.transaction(async (tx) => {
    // Trava o dono do anexo: dois envios simultâneos não furam o limite por item.
    const lockQuery =
      owner.kind === "demand"
        ? tx.select({ id: demandsTable.id, authorId: demandsTable.authorId }).from(demandsTable).where(eq(demandsTable.id, owner.id))
        : tx.select({ id: publicWorksTable.id }).from(publicWorksTable).where(eq(publicWorksTable.id, owner.id));
    const [row] = (await lockQuery.limit(1).for("update")) as { id: number; authorId?: number }[];
    if (!row) return { error: 404 as const };
    if (owner.kind === "demand" && row.authorId !== user.id && !["admin", "secretary"].includes(user.role)) {
      return { error: 403 as const };
    }

    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(attachmentsTable).where(eq(ownerCol, owner.id));
    if (n >= MAX_PER_ENTITY) return { error: "limit-item" as const };

    const [{ recent }] = await tx
      .select({ recent: sql<number>`count(*)::int` })
      .from(attachmentsTable)
      .where(and(eq(attachmentsTable.uploadedById, user.id), gt(attachmentsTable.createdAt, sql`now() - interval '1 hour'`)));
    if (recent >= MAX_UPLOADS_PER_HOUR) return { error: "rate" as const };

    const [{ total }] = await tx.select({ total: sql<number>`coalesce(sum(size_bytes), 0)::bigint` }).from(attachmentsTable);
    if (Number(total) + data.length > MAX_TOTAL_BYTES) return { error: "storage" as const };

    const [att] = await tx
      .insert(attachmentsTable)
      .values({
        ...(owner.kind === "demand" ? { demandId: owner.id } : { publicWorkId: owner.id }),
        uploadedById: user.id,
        mimeType: type,
        sizeBytes: data.length,
        data,
      })
      .returning({ id: attachmentsTable.id, mimeType: attachmentsTable.mimeType, sizeBytes: attachmentsTable.sizeBytes });
    return { att };
  });

  if ("error" in created) {
    switch (created.error) {
      case 404: res.status(404).json({ error: "Not found" }); return;
      case 403: res.status(403).json({ error: "Forbidden" }); return;
      case "limit-item": res.status(409).json({ error: `Limite de ${MAX_PER_ENTITY} fotos por item atingido.` }); return;
      case "rate": res.status(429).json({ error: "Muitos envios na última hora. Tente novamente mais tarde." }); return;
      case "storage": res.status(507).json({ error: "Armazenamento de fotos esgotado. Avise a administração." }); return;
    }
  }
  const { att } = created as { att: { id: number; mimeType: string; sizeBytes: number } };
  res.status(201).json({ id: att.id, url: `/api/attachments/${att.id}`, mimeType: att.mimeType, sizeBytes: att.sizeBytes });
}

router.post("/demands/:id/attachments", requireAuth, rawImage, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    await saveAttachment(req, res, { kind: "demand", id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/public-works/:id/attachments", requireAdmin, rawImage, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    await saveAttachment(req, res, { kind: "publicWork", id });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/attachments/:id", optionalAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [att] = await db
      .select({
        data: attachmentsTable.data,
        mimeType: attachmentsTable.mimeType,
        demandId: attachmentsTable.demandId,
        demandApproved: demandsTable.isApproved,
        demandAuthorId: demandsTable.authorId,
      })
      .from(attachmentsTable)
      .leftJoin(demandsTable, eq(attachmentsTable.demandId, demandsTable.id))
      .where(eq(attachmentsTable.id, id))
      .limit(1);
    if (!att) { res.status(404).json({ error: "Not found" }); return; }
    // Moderação: foto de demanda pendente só para o autor e a gestão. 404 (não 403) para não
    // revelar que o anexo existe.
    const restricted = att.demandId !== null && att.demandApproved === false;
    if (restricted && !canSee((req as any).currentUser, { isApproved: false, authorId: att.demandAuthorId ?? -1 })) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.set({
      "Content-Type": att.mimeType,
      "Content-Length": String(att.data.length),
      // Publicada: o anexo nunca muda (só é criado ou apagado), cache longo. Pendente: nunca guardar.
      "Cache-Control": restricted ? "private, no-store" : "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.send(att.data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/attachments/:id", requireAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const user = (req as any).currentUser as SessionUser;
    const [att] = await db
      .select({
        uploadedById: attachmentsTable.uploadedById,
        demandAuthorId: demandsTable.authorId,
      })
      .from(attachmentsTable)
      .leftJoin(demandsTable, eq(attachmentsTable.demandId, demandsTable.id))
      .where(eq(attachmentsTable.id, id))
      .limit(1);
    if (!att) { res.status(404).json({ error: "Not found" }); return; }
    const manager = user.role === "admin" || user.role === "secretary";
    if (!manager && att.uploadedById !== user.id && att.demandAuthorId !== user.id) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    await db.delete(attachmentsTable).where(eq(attachmentsTable.id, id));
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
