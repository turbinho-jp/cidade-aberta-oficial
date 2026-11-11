import { Megaphone, ArrowRightLeft, MessageCircle, ThumbsUp, CheckCircle2, ClipboardList, Circle } from "lucide-react";
import { cn } from "@/lib/utils";

const TYPES: Record<string, { icon: typeof Circle; className: string }> = {
  demand_created: { icon: Megaphone, className: "bg-orange-100 text-orange-600 border-orange-300" },
  status_changed: { icon: ArrowRightLeft, className: "bg-blue-100 text-blue-600 border-blue-300" },
  comment_added: { icon: MessageCircle, className: "bg-slate-100 text-slate-600 border-slate-300" },
  confirmation_added: { icon: ThumbsUp, className: "bg-green-100 text-green-600 border-green-300" },
  demand_resolved: { icon: CheckCircle2, className: "bg-emerald-100 text-emerald-700 border-emerald-400" },
  service_order_created: { icon: ClipboardList, className: "bg-violet-100 text-violet-600 border-violet-300" },
};

/** Ícone e cor por tipo de evento, para o feed distinguir de relance o que aconteceu. */
export function ActivityIcon({ type, className }: { type: string; className?: string }) {
  const cfg = TYPES[type] ?? { icon: Circle, className: "bg-muted text-muted-foreground border-border" };
  const Icon = cfg.icon;
  return (
    <div className={cn("absolute left-0 w-6 h-6 rounded-full border z-10 flex items-center justify-center", cfg.className, className)}>
      <Icon className="w-3.5 h-3.5" />
    </div>
  );
}
