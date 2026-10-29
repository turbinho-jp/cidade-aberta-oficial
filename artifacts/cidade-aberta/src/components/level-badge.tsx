import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { getLevelProgress } from "@/lib/gamification";

/** Selo com ícone e nome da patente. `compact` mostra só o ícone (com o nome no tooltip). */
export function LevelBadge({ points, compact = false, className }: { points: number; compact?: boolean; className?: string }) {
  const { level } = getLevelProgress(points);
  const Icon = level.icon;
  return (
    <span
      title={level.name}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-semibold whitespace-nowrap",
        compact ? "p-1" : "px-2.5 py-0.5 text-xs",
        level.color,
        className,
      )}
    >
      <Icon className="w-3.5 h-3.5" aria-hidden />
      {compact ? <span className="sr-only">{level.name}</span> : level.name}
    </span>
  );
}

/** Barra de progresso até a próxima patente. */
export function LevelProgressBar({ points, className }: { points: number; className?: string }) {
  const { level, next, percent, pointsToNext } = getLevelProgress(points);
  return (
    <div className={cn("space-y-1.5", className)}>
      <Progress value={percent} className="h-2" aria-label={`Progresso até ${next?.name ?? level.name}`} />
      <p className="text-xs text-muted-foreground">
        {next
          ? <>Faltam <strong className="text-foreground">{pointsToNext}</strong> pts para <strong className="text-foreground">{next.name}</strong></>
          : "Você chegou à patente máxima."}
      </p>
    </div>
  );
}
