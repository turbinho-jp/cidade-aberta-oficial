/**
 * Reduz a foto no próprio navegador antes de enviar (canvas, sem biblioteca).
 * Isso economiza o banco gratuito (uma foto de celular de 4 MB vira ~300 KB),
 * acelera o envio em rede móvel e, de quebra, remove o EXIF (inclui a posição GPS).
 */
export const MAX_PHOTOS = 5;

const MAX_SIDE = 1600;
const TARGET_BYTES = 700_000; // o servidor aceita até 1 MB

export class ImageError extends Error {}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
}

export async function compressImage(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/")) {
    throw new ImageError("O arquivo escolhido não é uma imagem.");
  }
  let bitmap: ImageBitmap;
  try {
    // Respeita a orientação EXIF (fotos de celular "em pé").
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("Não foi possível ler essa imagem. Tente uma foto em JPEG ou PNG.");
  }

  let scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  try {
    for (let attempt = 0; attempt < 6; attempt++) {
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bitmap.width * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new ImageError("Seu navegador não conseguiu processar a imagem.");
      // Fundo branco: PNG transparente não vira preto ao virar JPEG.
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);

      for (const quality of [0.82, 0.7, 0.58]) {
        const blob = await canvasToBlob(canvas, quality);
        if (blob && blob.size <= TARGET_BYTES) return blob;
      }
      scale *= 0.75;
    }
  } finally {
    bitmap.close();
  }
  throw new ImageError("Não foi possível reduzir essa imagem o suficiente. Escolha outra foto.");
}

const AVATAR_SIDE = 256;
const AVATAR_TARGET_BYTES = 80_000; // o servidor aceita até 100 KB

/**
 * Foto de perfil: recorta o quadrado central, reduz para 256×256 e devolve um JPEG pequeno
 * (cerca de 20–40 KB). Tira o EXIF (inclui a posição GPS) como efeito do redesenho no canvas.
 */
export async function compressAvatar(file: File): Promise<Blob> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    throw new ImageError("Escolha uma foto em JPEG, PNG ou WebP.");
  }
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new ImageError("Não foi possível ler essa imagem. Tente uma foto em JPEG ou PNG.");
  }
  try {
    const side = Math.min(bitmap.width, bitmap.height);
    const sx = Math.round((bitmap.width - side) / 2);
    const sy = Math.round((bitmap.height - side) / 2);
    const canvas = document.createElement("canvas");
    canvas.width = AVATAR_SIDE;
    canvas.height = AVATAR_SIDE;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new ImageError("Seu navegador não conseguiu processar a imagem.");
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, AVATAR_SIDE, AVATAR_SIDE);
    ctx.drawImage(bitmap, sx, sy, side, side, 0, 0, AVATAR_SIDE, AVATAR_SIDE);
    for (const quality of [0.85, 0.75, 0.65, 0.5]) {
      const blob = await canvasToBlob(canvas, quality);
      if (blob && blob.size <= AVATAR_TARGET_BYTES) return blob;
    }
  } finally {
    bitmap.close();
  }
  throw new ImageError("Não foi possível reduzir essa imagem o suficiente. Escolha outra foto.");
}
