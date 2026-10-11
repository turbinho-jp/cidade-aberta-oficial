import React from "react";
import * as Icons from "lucide-react";
import { cn } from "@/lib/utils";

interface CategoryIconProps {
  name: string;
  className?: string;
}

export function CategoryIcon({ name, className }: CategoryIconProps) {
  // Convert something like "alert-triangle" to "AlertTriangle"
  const formattedName = name
    .split("-")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join("");

  const IconComponent = (Icons as any)[formattedName] || Icons.HelpCircle;

  return <IconComponent className={cn("w-5 h-5", className)} />;
}
