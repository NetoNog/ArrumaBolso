import { ArrowDownRight, ArrowUpRight, type LucideIcon, Minus } from "lucide-react";
import { cn } from "cn";

export type TrendTone = "good" | "bad" | "neutral";

export function KpiCard({
  icon: Icon,
  iconClassName,
  value,
  subtitle,
  trend,
}: {
  icon: LucideIcon;
  /** Soft background + foreground classes for the icon badge. */
  iconClassName: string;
  value: string;
  subtitle: string;
  trend: { direction: "up" | "down" | "flat"; label: string; tone: TrendTone };
}) {
  const TrendIcon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  return (
    <div className="flex flex-col gap-4 rounded-xl border bg-card p-4 shadow-panel">
      <div className="flex items-start justify-between gap-2">
        <span className={cn("flex size-9 items-center justify-center rounded-lg", iconClassName)}>
          <Icon className="size-[18px]" />
        </span>
        <span
          className={cn(
            "num inline-flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-xs font-medium",
            trend.tone === "good" && "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300",
            trend.tone === "bad" && "bg-rose-50 text-rose-700 dark:bg-rose-500/10 dark:text-rose-300",
            trend.tone === "neutral" && "bg-muted text-muted-foreground",
          )}
        >
          <TrendIcon className="size-3.5" />
          {trend.label}
        </span>
      </div>
      <div className="grid gap-0.5">
        <span className="num text-2xl leading-tight font-semibold tracking-tight text-foreground">{value}</span>
        <span className="text-sm text-muted-foreground">{subtitle}</span>
      </div>
    </div>
  );
}
