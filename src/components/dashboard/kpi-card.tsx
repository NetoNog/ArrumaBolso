"use client";

import { ArrowDownRight, ArrowUpRight, type LucideIcon, Minus } from "lucide-react";
import { cn } from "cn";

import { usePrivacy } from "@/components/app/privacy-provider";

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
  const { hidden, mask } = usePrivacy();
  const TrendIcon = trend.direction === "up" ? ArrowUpRight : trend.direction === "down" ? ArrowDownRight : Minus;
  const displayValue = value.includes("R$") ? mask(value) : value;
  const displayTrend = hidden && trend.label.includes("R$") ? "••••" : trend.label;
  return (
    <div className="flex min-w-0 flex-col justify-between gap-2.5 rounded-2xl border border-border/80 bg-card p-3.5 shadow-panel transition-colors hover:border-brand/25 dark:border-white/[0.08] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.04),var(--shadow-panel)] sm:gap-4 sm:rounded-xl sm:p-4">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <span className={cn("flex size-8 shrink-0 items-center justify-center rounded-xl sm:size-9 sm:rounded-lg", iconClassName)}>
          <Icon className="size-4 sm:size-[18px]" />
        </span>
        <span
          className={cn(
            "num inline-flex max-w-full items-center gap-0.5 rounded-lg px-1.5 py-0.5 text-[10.5px] leading-tight font-semibold whitespace-nowrap sm:text-xs",
            trend.tone === "good" && "bg-positive-soft text-positive",
            trend.tone === "bad" && "bg-negative-soft text-negative",
            trend.tone === "neutral" && "bg-muted text-muted-foreground",
          )}
        >
          <TrendIcon className="size-3 shrink-0 sm:size-3.5" />
          <span>{displayTrend}</span>
        </span>
      </div>
      <div className="grid min-w-0 gap-0.5">
        <span className="num text-[16px] leading-snug font-bold tracking-tight text-foreground sm:text-2xl sm:font-semibold">
          {displayValue}
        </span>
        <span className="text-[11.5px] leading-snug text-muted-foreground sm:text-sm">
          {subtitle}
        </span>
      </div>
    </div>
  );
}
