import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  /** Demanda ainda não aprovada pela moderação: mostra "Em análise" no lugar do status. */
  pending?: boolean;
  className?: string;
}

/** Demanda aguardando moderação (e não rejeitada). `isApproved` só vem false para autor e gestão. */
export function isPendingModeration(d: { isApproved?: boolean; status: string }) {
  return d.isApproved === false && d.status !== "rejected";
}

export function StatusBadge({ status, pending, className }: StatusBadgeProps) {
  const colorClass = pending ? "bg-amber-100 text-amber-900" : STATUS_COLORS[status] || "bg-gray-500 text-white";
  const label = pending ? "Em análise" : STATUS_LABELS[status] || status;

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium border-0 shadow-sm", colorClass, className)}
    >
      {label}
    </Badge>
  );
}
