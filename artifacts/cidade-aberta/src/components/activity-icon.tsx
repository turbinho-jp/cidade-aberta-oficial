import { Megaphone, ArrowRight, MessageCircle, Check, BadgeCheck, ClipboardList, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES: Record<string, { icon: typeof Circle; className: string; label: string }> = {
  demand_created: { icon: Megaphone, className: "bg-orange-100 text-orange-600 border-orange-300", label: "Nova demanda" },
  status_changed: { icon: ArrowRight, className: "bg-blue-100 text-blue-600 border-blue-300", label: "Mudança de status" },
  comment_added: { icon: MessageCircle, className: "bg-slate-100 text-slate-600 border-slate-300", label: "Comentário" },
  confirmation_added: { icon: Check, className: "bg-green-100 text-green-600 border-green-300", label: "Apoio" },
  demand_resolved: { icon: BadgeCheck, className: "bg-teal-100 text-teal-700 border-teal-400", label: "Demanda resolvida" },
  service_order_created: { icon: ClipboardList, className: "bg-violet-100 text-violet-600 border-violet-300", label: "Ordem de serviço" },
};

/** Ícone e cor por tipo de evento, para o feed distinguir de relance o que aconteceu. */
export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const cfg = TYPES[type] ?? { icon: Circle, className: "bg-muted text-muted-foreground border-border", label: "Atividade" };
  const Icon = cfg.icon;
  return (
    <div title={cfg.label} aria-label={cfg.label} role="img" className={cn("absolute left-0 w-6 h-6 rounded-full border z-10 flex items-center justify-center", cfg.className, className)}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}
