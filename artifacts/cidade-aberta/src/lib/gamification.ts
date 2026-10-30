import { Sprout, Eye, ShieldCheck, Landmark, Crown, type LucideIcon } from "lucide-react";

/**
 * Patentes da gamificação. São derivadas dos pontos (não ficam gravadas no banco), então
 * ajustar os limites aqui vale para todo mundo na hora, sem migração.
 * Os valores de pontos de cada ação ficam no servidor: artifacts/api-server/src/lib/gamification.ts.
 */
export interface Level {
  id: number;
  name: string;
  /** Pontos mínimos para chegar a esta patente. */
  min: number;
  icon: LucideIcon;
  /** Classes de cor (texto + fundo + borda) para o selo. */
  color: string;
}

export const LEVELS: Level[] = [
  { id: 1, name: "Cidadão Atento", min: 0, icon: Sprout, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
  { id: 2, name: "Monitor do Bairro", min: 101, icon: Eye, color: "text-sky-700 bg-sky-50 border-sky-200" },
  { id: 3, name: "Guardião da Comunidade", min: 501, icon: ShieldCheck, color: "text-violet-700 bg-violet-50 border-violet-200" },
  { id: 4, name: "Vereador Comunitário", min: 1501, icon: Landmark, color: "text-orange-700 bg-orange-50 border-orange-200" },
  { id: 5, name: "Prefeito Comunitário", min: 3001, icon: Crown, color: "text-amber-700 bg-amber-50 border-amber-300" },
];

export interface LevelProgress {
  level: Level;
  next: Level | null;
  /** 0 a 100. No último nível, sempre 100. */
  percent: number;
  pointsToNext: number;
}

export function getLevelProgress(points: number): LevelProgress {
  const safe = Math.max(0, Math.floor(points));
  let idx = 0;
  for (let i = 0; i < LEVELS.length; i++) if (safe >= LEVELS[i]!.min) idx = i;
  const level = LEVELS[idx]!;
  const next = LEVELS[idx + 1] ?? null;
  if (!next) return { level, next: null, percent: 100, pointsToNext: 0 };
  const span = next.min - level.min;
  return {
    level,
    next,
    percent: Math.min(100, Math.round(((safe - level.min) / span) * 100)),
    pointsToNext: next.min - safe,
  };
}

/** Texto do motivo de cada lançamento no histórico de pontos. */
export const REASON_LABELS: Record<string, string> = {
  demand_published: "Demanda publicada",
  support_given: "Você apoiou uma demanda",
  support_received: "Apoio na sua demanda",
  comment_posted: "Comentário",
  demand_resolved: "Demanda resolvida",
  resolution_validated: "Você confirmou que foi resolvido",
  resolution_validation_received: "Confirmaram que sua demanda foi resolvida",
};

/** Como ganhar pontos (espelha as regras do servidor). */
export const HOW_TO_EARN: { label: string; points: number; note?: string }[] = [
  { label: "Demanda publicada pela moderação", points: 10 },
  { label: "Apoiar a demanda de outra pessoa", points: 2 },
  { label: "Alguém apoiar a sua demanda", points: 5, note: "até 10 apoios por demanda" },
  { label: "Comentar numa demanda", points: 2, note: "até 3 comentários por demanda" },
  { label: "Sua demanda ser resolvida pelo órgão", points: 50 },
  { label: "Confirmar que a demanda de outra pessoa foi mesmo resolvida", points: 15, note: "até 3 confirmações por demanda" },
  { label: "Alguém confirmar que a sua demanda foi resolvida", points: 15, note: "até 3 confirmações por demanda" },
];

export interface Achievement {
  id: string;
  name: string;
  description: string;
  earned: boolean;
}

/** Conquistas calculadas a partir dos contadores do perfil (não são gravadas). */
export function getAchievements(c: { demandsCount: number; confirmationsCount: number; commentsCount: number }): Achievement[] {
  return [
    { id: "first-demand", name: "Primeiro Passo", description: "Enviou a primeira demanda", earned: c.demandsCount >= 1 },
    { id: "mapper", name: "Mapeador", description: "Enviou 5 demandas", earned: c.demandsCount >= 5 },
    { id: "supporter", name: "Apoiador", description: "Apoiou 10 demandas", earned: c.confirmationsCount >= 10 },
    { id: "voice", name: "Voz Ativa", description: "Fez 10 comentários", earned: c.commentsCount >= 10 },
  ];
}
