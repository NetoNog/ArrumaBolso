import type { ReactNode } from "react";
import { cn } from "cn";

export type PillTone = "blue" | "amber" | "violet" | "emerald" | "rose" | "slate" | "pink" | "sky";

const TONES: Record<PillTone, string> = {
  blue: "bg-info-soft text-info border-info/25",
  amber: "bg-warning-soft text-warning border-warning/25",
  violet: "bg-violet-50 text-violet-700 border-violet-200/80 dark:bg-violet-500/14 dark:text-violet-300 dark:border-violet-400/25",
  emerald: "bg-positive-soft text-positive border-positive/25",
  rose: "bg-negative-soft text-negative border-negative/25",
  pink: "bg-pink-50 text-pink-700 border-pink-200/80 dark:bg-pink-500/14 dark:text-pink-300 dark:border-pink-400/25",
  sky: "bg-sky-50 text-sky-700 border-sky-200/80 dark:bg-sky-500/14 dark:text-sky-300 dark:border-sky-400/25",
  slate: "bg-surface-subtle text-muted-foreground border-border",
};

export function Pill({
  tone = "slate",
  className,
  children,
}: {
  tone?: PillTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-5 shrink-0 items-center gap-1 rounded-full border px-2 text-[10.5px] font-semibold tracking-wide whitespace-nowrap uppercase",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
