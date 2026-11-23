import { Router } from "express";
import { db, demandsTable, attachmentsTable, neighborhoodsTable } from "@workspace/db";
import { eq, asc } from "drizzle-orm";
import { parseId } from "../lib/validate";

const router = Router();

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Entrega meta tags Open Graph (foto, título e descrição) para WhatsApp/redes
// e redireciona visitantes humanos para /demandas/:id.
router.get("/share/demands/:id", async (req, res) => {
  const id = parseId(req.params.id);
  const proto = req.get("x-forwarded-proto") || req.protocol || "https";
  const host = req.get("x-forwarded-host") || req.get("host") || "";
  const origin = `${proto}://${host}`;

  if (id === null) {
    return res.redirect(302, `${origin}/demandas`);
  }

  try {
    const [demand] = await db
      .select({
        id: demandsTable.id,
        title: demandsTable.title,
        description: demandsTable.description,
        address: demandsTable.address,
        neighborhoodId: demandsTable.neighborhoodId,
        isApproved: demandsTable.isApproved,
      })
      .from(demandsTable)
      .where(eq(demandsTable.id, id))
      .limit(1);

    const targetUrl = `${origin}/demandas/${id}`;

    if (!demand || !demand.isApproved) {
      return res.redirect(302, targetUrl);
    }

    const [firstPhoto, [nbr]] = await Promise.all([
      db
        .select({ id: attachmentsTable.id })
        .from(attachmentsTable)
        .where(eq(attachmentsTable.demandId, id))
        .orderBy(asc(attachmentsTable.id))
        .limit(1)
        .then((rows) => rows[0]),
      demand.neighborhoodId
        ? db
            .select({ name: neighborhoodsTable.name })
            .from(neighborhoodsTable)
            .where(eq(neighborhoodsTable.id, demand.neighborhoodId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    const title = escapeHtml(`${demand.title} — Cidade Aberta`);
    const locationPrefix = nbr?.name ? `${nbr.name} · ` : "";
    const rawDesc = `${locationPrefix}${demand.description}`.slice(0, 180);
    const description = escapeHtml(rawDesc);
    const imageUrl = firstPhoto ? `${origin}/api/attachments/${firstPhoto.id}` : "";

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.send(`<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <meta name="description" content="${description}" />
  <meta property="og:type" content="article" />
  <meta property="og:site_name" content="Cidade Aberta" />
  <meta property="og:title" content="${title}" />
  <meta property="og:description" content="${description}" />
  <meta property="og:url" content="${escapeHtml(targetUrl)}" />
  ${imageUrl ? `<meta property="og:image" content="${escapeHtml(imageUrl)}" />` : ""}
  <meta name="twitter:card" content="${imageUrl ? "summary_large_image" : "summary"}" />
  <meta name="twitter:title" content="${title}" />
  <meta name="twitter:description" content="${description}" />
  ${imageUrl ? `<meta name="twitter:image" content="${escapeHtml(imageUrl)}" />` : ""}
  <meta http-equiv="refresh" content="0;url=${escapeHtml(targetUrl)}" />
</head>
<body>
  <p>Redirecionando para <a href="${escapeHtml(targetUrl)}">${title}</a>...</p>
  <script>window.location.replace(${JSON.stringify(targetUrl)});</script>
</body>
</html>`);
  } catch (err) {
    req.log?.error(err);
    res.redirect(302, `${origin}/demandas/${id}`);
  }
});

export default router;