import type { ReactNode } from "react";
import { cn } from "cn";

export type PillTone = "blue" | "amber" | "violet" | "emerald" | "rose" | "slate" | "pink" | "sky";

const TONES: Record<PillTone, string> = {
  blue: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-300 dark:border-blue-500/30",
  amber: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-300 dark:border-amber-500/30",
  violet: "bg-violet-50 text-violet-700 border-violet-200 dark:bg-violet-500/10 dark:text-violet-300 dark:border-violet-500/30",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/30",
  rose: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-500/10 dark:text-rose-300 dark:border-rose-500/30",
  pink: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-500/10 dark:text-pink-300 dark:border-pink-500/30",
  sky: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-500/10 dark:text-sky-300 dark:border-sky-500/30",
  slate: "bg-slate-50 text-slate-600 border-slate-200 dark:bg-zinc-800/60 dark:text-zinc-300 dark:border-zinc-700",
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
