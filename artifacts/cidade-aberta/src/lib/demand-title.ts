/**
 * Título automático de uma demanda sem título: "[Categoria] em [Bairro] — [Endereço curto]".
 * Espelha artifacts/api-server/src/lib/demand-title.ts (o servidor aplica a mesma regra se vier sem título).
 * Ao ajustar uma, altere as duas.
 */
export const AUTO_TITLE_MAX = 120;

/** Primeiro trecho do endereço (antes da vírgula) que tenha letras, ex.: "Av. Epitácio Pessoa, 1000" -> "Av. Epitácio Pessoa". */
export function shortAddress(address: string): string {
  const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.find((p) => /[A-Za-zÀ-ÿ]{3,}/.test(p)) ?? parts[0] ?? "";
}

export function buildAutoTitle(category: string | undefined, neighborhood: string | undefined, address: string): string {
  const head = `${category?.trim() || "Problema urbano"}${neighborhood?.trim() ? ` em ${neighborhood.trim()}` : ""}`;
  const short = shortAddress(address);
  const title = short ? `${head} — ${short}` : head;
  return title.length > AUTO_TITLE_MAX ? `${title.slice(0, AUTO_TITLE_MAX - 1).trimEnd()}…` : title;
}
