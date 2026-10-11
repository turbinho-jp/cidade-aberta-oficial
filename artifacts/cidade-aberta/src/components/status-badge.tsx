import { Badge } from "@/components/ui/badge";
import { STATUS_COLORS, STATUS_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const colorClass = STATUS_COLORS[status] || "bg-gray-500 text-white";
  const label = STATUS_LABELS[status] || status;

  return (
    <Badge 
      variant="outline" 
      className={cn("font-medium border-0 shadow-sm", colorClass, className)}
    >
      {label}
    </Badge>
  );
}
