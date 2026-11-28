/**
 * Foto de perfil, guardada em `users.avatar_url` (data URL; ver lib/avatar.ts).
 *
 *   PUT    /api/users/me/avatar    corpo = bytes da imagem (Content-Type image/jpeg|png|webp)
 *   GET    /api/users/:id/avatar   devolve a imagem
 *   DELETE /api/users/:id/avatar   a própria pessoa ou a equipe da prefeitura (moderação)
 *
 * Liberada só a quem chegou ao nível Prefeito (AVATAR_UNLOCK_POINTS); a equipe é dispensada.
 * Segurança: o tipo vem dos primeiros bytes (SVG e qualquer outra coisa são recusados), o JPEG perde
 * EXIF/GPS, tamanho em bytes e em pixels têm teto e o envio tem limite por hora.
 */
import express, { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireAuth, requireVerifiedEmail, isStaff, type SessionUser } from "../lib/auth";
import { parseId, sendValidationError } from "../lib/validate";
import { ALLOWED_IMAGE_TYPES, getImageSize, sniffImageType, stripJpegMetadata } from "../lib/images";
import {
  AVATAR_MAX_BYTES, AVATAR_MAX_SIDE, AVATAR_UPLOADS_PER_HOUR,
  avatarUrlOf, parseAvatarDataUrl, toAvatarDataUrl,
} from "../lib/avatar";
import { AVATAR_UNLOCK_POINTS } from "../lib/gamification";
import { avatarUploadBlocked } from "../lib/rate-limit";

const router = Router();

const rawImage = express.raw({ type: [...ALLOWED_IMAGE_TYPES], limit: AVATAR_MAX_BYTES });

router.put("/users/me/avatar", requireAuth, requireVerifiedEmail, rawImage, async (req, res) => {
  try {
    const me = (req as any).currentUser as SessionUser;

    // Pontos lidos do banco na hora: o cookie de sessão não os carrega.
    const [row] = await db.select({ points: usersTable.points }).from(usersTable).where(eq(usersTable.id, me.id)).limit(1);
    if (!row) { res.status(401).json({ error: "Unauthorized" }); return; }
    if (!isStaff(me.role) && row.points < AVATAR_UNLOCK_POINTS) {
      res.status(403).json({
        error: `A foto de perfil é liberada no nível Prefeito (${AVATAR_UNLOCK_POINTS} pontos).`,
        code: "AVATAR_LOCKED",
      });
      return;
    }

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
    const size = getImageSize(data, type);
    if (!size || size.width < 1 || size.height < 1) {
      sendValidationError(res, { file: "não foi possível ler as dimensões da imagem" });
      return;
    }
    if (size.width > AVATAR_MAX_SIDE || size.height > AVATAR_MAX_SIDE) {
      sendValidationError(res, { file: `imagem grande demais (máximo ${AVATAR_MAX_SIDE}×${AVATAR_MAX_SIDE} pixels)` });
      return;
    }

    if (await avatarUploadBlocked(me.id, AVATAR_UPLOADS_PER_HOUR)) {
      res.setHeader("Retry-After", "3600");
      res.status(429).json({ error: "Muitas trocas de foto na última hora. Tente novamente mais tarde." });
      return;
    }

    const stored = toAvatarDataUrl(type, data);
    await db.update(usersTable).set({ avatarUrl: stored, updatedAt: new Date() }).where(eq(usersTable.id, me.id));
    res.json({ avatarUrl: avatarUrlOf({ id: me.id, avatarUrl: stored }) });
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/users/:id/avatar", async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const [row] = await db.select({ avatarUrl: usersTable.avatarUrl }).from(usersTable).where(eq(usersTable.id, id)).limit(1);
    const img = parseAvatarDataUrl(row?.avatarUrl);
    if (!img) { res.status(404).json({ error: "Not found" }); return; }
    res.set({
      "Content-Type": img.type,
      "Content-Length": String(img.data.length),
      // Com ?v=<versão> a URL muda quando a foto muda, então o cache pode ser longo.
      "Cache-Control": req.query["v"] ? "public, max-age=31536000, immutable" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox",
    });
    res.send(img.data);
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/users/:id/avatar", requireAuth, async (req, res) => {
  try {
    const id = parseId(req.params.id);
    if (id === null) return sendValidationError(res, { id: "id inválido" });
    const me = (req as any).currentUser as SessionUser;
    // Só a própria pessoa ou a equipe da prefeitura (admin, secretário, moderador).
    if (me.id !== id && !isStaff(me.role)) { res.status(403).json({ error: "Forbidden" }); return; }
    const removed = await db.update(usersTable).set({ avatarUrl: null, updatedAt: new Date() })
      .where(eq(usersTable.id, id)).returning({ id: usersTable.id });
    if (removed.length === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.status(204).end();
  } catch (err) {
    req.log.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
