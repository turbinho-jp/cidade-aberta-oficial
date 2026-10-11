import { DemandStatus, DemandDetailStatus } from "@workspace/api-client-react";

export const STATUS_COLORS: Record<string, string> = {
  open: "bg-amber-500 text-amber-950",
  under_review: "bg-blue-500 text-white",
  approved: "bg-indigo-500 text-white",
  in_progress: "bg-cyan-500 text-cyan-950",
  completed: "bg-green-500 text-white",
  rejected: "bg-red-500 text-white",
  closed: "bg-slate-500 text-white",
  
  // OS Statuses
  pending: "bg-slate-200 text-slate-800 dark:bg-slate-800 dark:text-slate-200",
  assigned: "bg-amber-500 text-amber-950",
  cancelled: "bg-red-500 text-white",

  // Public Works Statuses
  planned: "bg-slate-500 text-white",
  suspended: "bg-red-500 text-white",
};

export const STATUS_LABELS: Record<string, string> = {
  open: "Aberto",
  under_review: "Em Análise",
  approved: "Aprovado",
  in_progress: "Em Andamento",
  completed: "Concluído",
  rejected: "Rejeitado",
  closed: "Fechado",

  pending: "Pendente",
  assigned: "Atribuído",
  cancelled: "Cancelado",

  planned: "Planejado",
  suspended: "Suspenso",
};

export const PRIORITY_LABELS: Record<string, string> = {
  low: "Baixa",
  medium: "Média",
  high: "Alta",
  urgent: "Urgente",
};
