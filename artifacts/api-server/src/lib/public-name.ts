/**
 * Nome para exibição pública (feed, ranking, cards, comentários): primeiro nome + inicial do último
 * sobrenome. "Alexandre da Silva Araujo" -> "Alexandre A.". Nomes de uma palavra ("Turbo33") ficam
 * como estão. O nome completo continua só no banco e na própria conta da pessoa.
 *
 * Contas da prefeitura devem usar nome institucional de UMA palavra (ex.: "Infraestrutura"),
 * senão também serão abreviadas.
 */
export function publicName(name: string | null | undefined): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "Cidadão";
  if (parts.length === 1) return parts[0]!;
  const first = parts[0]!;
  const last = parts[parts.length - 1]!;
  const cap = first.charAt(0).toLocaleUpperCase("pt-BR") + first.slice(1).toLocaleLowerCase("pt-BR");
  return `${cap} ${last.charAt(0).toLocaleUpperCase("pt-BR")}.`;
}

/** Igual a `publicName`, mas preserva null/undefined (eventos sem autor). */
export function publicNameOrNull(name: string | null | undefined): string | null {
  return name ? publicName(name) : null;
}
