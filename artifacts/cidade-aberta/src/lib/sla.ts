/**
 * Prazos de resposta estimados (SLA) por categoria.
 * A categoria é reconhecida pelo nome (sem acento/maiúscula), então funciona com os nomes do seed
 * ("Iluminação pública", "Trânsito e sinalização"...) e com variações ("Mobilidade Urbana / Trânsito").
 * Categorias sem regra (ex.: Segurança, Outros) não exibem prazo.
 */
export type CategorySla = { label: string; area: string };

const norm = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

// A ordem importa: a primeira regra que casar vence.
const RULES: { test: RegExp; sla: CategorySla }[] = [
  { test: /ilumina|poste|lampada/, sla: { area: "Iluminação Pública", label: "48 horas" } },
  { test: /limpeza|capina|lixo|entulho/, sla: { area: "Limpeza Urbana & Capina", label: "72 horas" } },
  { test: /mobilidade|transito|sinaliza|semaforo/, sla: { area: "Mobilidade Urbana / Trânsito", label: "3 a 5 dias úteis" } },
  { test: /meio ambiente|arvore|areas? verde|poda/, sla: { area: "Meio Ambiente", label: "5 dias úteis" } },
  { test: /infraestrutura|drenagem|buraco|via\b|agua|esgoto|bueiro|pavimenta/, sla: { area: "Infraestrutura & Drenagem", label: "7 dias úteis" } },
];

export function getCategorySla(categoryName?: string | null): CategorySla | null {
  if (!categoryName) return null;
  const n = norm(categoryName);
  return RULES.find((r) => r.test.test(n))?.sla ?? null;
}
