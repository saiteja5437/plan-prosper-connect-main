import { type ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { TrendingDown, TrendingUp } from "lucide-react";

export type KpiTone = "default" | "success" | "warning" | "destructive" | "info";

export function KpiCard({
  label,
  value,
  hint,
  trend,
  icon,
  tone = "default",
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  trend?: number;
  icon?: ReactNode;
  tone?: KpiTone;
}) {
  const toneRing: Record<KpiTone, string> = {
    default: "before:bg-primary/70",
    success: "before:bg-success",
    warning: "before:bg-warning",
    destructive: "before:bg-destructive",
    info: "before:bg-info",
  };
  return (
    <Card className={cn(
      "p-5 relative overflow-hidden",
      "before:absolute before:left-0 before:top-0 before:bottom-0 before:w-1",
      toneRing[tone],
    )}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">{label}</p>
          <p className="text-2xl font-semibold mt-1 tabular-nums">{value}</p>
        </div>
        {icon && <div className="text-muted-foreground">{icon}</div>}
      </div>
      {(hint || typeof trend === "number") && (
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {typeof trend === "number" && (
            <span className={cn("inline-flex items-center gap-0.5 font-medium", trend >= 0 ? "text-success" : "text-destructive")}>
              {trend >= 0 ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}
              {Math.abs(trend).toFixed(1)}%
            </span>
          )}
          {hint}
        </div>
      )}
    </Card>
  );
}