import { Clock } from "lucide-react";
import { getCategorySla } from "@/lib/sla";

/** Mostra o prazo estimado de resposta da categoria. Não renderiza nada se a categoria não tem prazo. */
export function SlaNotice({ categoryName, className = "" }: { categoryName?: string | null; className?: string }) {
  const sla = getCategorySla(categoryName);
  if (!sla) return null;
  return (
    <div
      role="note"
      className={`flex items-start gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm ${className}`}
    >
      <Clock className="w-4 h-4 mt-0.5 shrink-0 text-primary" />
      <span>
        <strong>Prazo estimado de resposta: {sla.label}.</strong>{" "}
        <span className="text-muted-foreground">Estimativa para {sla.area}; pode variar conforme a análise.</span>
      </span>
    </div>
  );
}
