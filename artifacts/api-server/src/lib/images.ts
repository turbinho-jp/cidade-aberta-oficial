/**
 * Validação de imagens sem dependências: o tipo é decidido pelos primeiros bytes
 * do arquivo (o Content-Type enviado pelo cliente é ignorado) e só JPEG, PNG e
 * WebP são aceitos. Em JPEG, os metadados EXIF/XMP (que podem conter a posição
 * GPS de quem tirou a foto) são removidos antes de gravar.
 */
export type ImageMime = "image/jpeg" | "image/png" | "image/webp";

export const ALLOWED_IMAGE_TYPES: readonly ImageMime[] = ["image/jpeg", "image/png", "image/webp"];

export function sniffImageType(buf: Buffer): ImageMime | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (
    buf.length >= 8 &&
    buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return "image/png";
  }
  if (buf.length >= 12 && buf.toString("latin1", 0, 4) === "RIFF" && buf.toString("latin1", 8, 12) === "WEBP") {
    return "image/webp";
  }
  return null;
}

/**
 * Remove os segmentos APP1 (EXIF/XMP) de um JPEG. Devolve `null` se a estrutura
 * do arquivo estiver malformada (arquivo rejeitado).
 */
export function stripJpegMetadata(buf: Buffer): Buffer | null {
  const out: Buffer[] = [buf.subarray(0, 2)]; // SOI
  let i = 2;
  while (i < buf.length) {
    if (buf[i] !== 0xff) return null;
    // Bytes de preenchimento 0xFF antes do marcador.
    while (i < buf.length && buf[i] === 0xff) i++;
    const marker = buf[i];
    if (marker === undefined) return null;
    i++;
    if (marker === 0xd9) {
      // EOI
      out.push(Buffer.from([0xff, 0xd9]));
      return Buffer.concat(out);
    }
    // Marcadores sem payload.
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      out.push(Buffer.from([0xff, marker]));
      continue;
    }
    if (i + 2 > buf.length) return null;
    const len = buf.readUInt16BE(i);
    if (len < 2 || i + len > buf.length) return null;
    if (marker === 0xda) {
      // SOS: dali em diante é o fluxo comprimido da imagem até o fim; copia tudo.
      out.push(Buffer.from([0xff, marker]), buf.subarray(i));
      return Buffer.concat(out);
    }
    if (marker !== 0xe1) {
      out.push(Buffer.from([0xff, marker]), buf.subarray(i, i + len));
    }
    i += len;
  }
  return null;
}
