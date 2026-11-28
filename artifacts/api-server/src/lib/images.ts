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

/**
 * Largura e altura em pixels, lidas do cabeçalho (sem decodificar a imagem). Devolve `null` se o
 * cabeçalho estiver truncado ou malformado. Serve para barrar imagens enormes antes de gravar.
 */
export function getImageSize(buf: Buffer, type: ImageMime): { width: number; height: number } | null {
  if (type === "image/png") {
    // 8 bytes de assinatura + chunk IHDR (tamanho, "IHDR", largura, altura).
    if (buf.length < 24 || buf.toString("latin1", 12, 16) !== "IHDR") return null;
    return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }
  if (type === "image/webp") {
    if (buf.length < 30) return null;
    const kind = buf.toString("latin1", 12, 16);
    if (kind === "VP8 ") {
      // Quadro-chave lossy: start code 9d 01 2a e depois 14 bits de largura e de altura.
      if (buf[23] !== 0x9d || buf[24] !== 0x01 || buf[25] !== 0x2a) return null;
      return { width: buf.readUInt16LE(26) & 0x3fff, height: buf.readUInt16LE(28) & 0x3fff };
    }
    if (kind === "VP8L") {
      if (buf[20] !== 0x2f) return null;
      const bits = buf.readUInt32LE(21);
      return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
    }
    if (kind === "VP8X") {
      // Largura e altura menos 1, em 24 bits cada.
      return { width: buf.readUIntLE(24, 3) + 1, height: buf.readUIntLE(27, 3) + 1 };
    }
    return null;
  }
  // JPEG: procura o primeiro marcador SOFn (0xC0..0xCF, menos DHT, JPG e DAC).
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) return null;
    while (i < buf.length && buf[i] === 0xff) i++;
    const marker = buf[i++];
    if (marker === undefined) return null;
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (marker === 0xd9 || marker === 0xda) return null; // chegou nos dados sem achar o SOF
    if (i + 2 > buf.length) return null;
    const len = buf.readUInt16BE(i);
    if (len < 2) return null;
    const isSof = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
    if (isSof) {
      if (i + 7 > buf.length) return null;
      return { height: buf.readUInt16BE(i + 3), width: buf.readUInt16BE(i + 5) };
    }
    i += len;
  }
  return null;
}
