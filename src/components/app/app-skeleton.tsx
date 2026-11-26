import type { CSSProperties } from "react";
import { cn } from "cn";

/** Smooth shimmer placeholder block (drops motion for reduced-motion users). */
function Bone({ className, style }: { className?: string; style?: CSSProperties }) {
  return <span className={cn("ab-shimmer block rounded-md", className)} style={style} aria-hidden />;
}

/**
 * Shown on cold start while initial data loads:
 * - Mobile (< md): faithful fintech layout (Hero Card + 4 squircle actions + floating rows) to avoid layout shift.
 * - Desktop (>= md): 4 KPIs + chart + alerts + table layout.
 */
export function AppSkeleton() {
  return (
    <div role="status" className="grid gap-5 md:gap-6">
      <span className="sr-only">Carregando seus dados financeiros...</span>

      {/* Mobile Fintech Skeleton (< md) */}
      <div className="grid gap-5 md:hidden">
        <div className="ab-shimmer h-[178px] rounded-[26px]" />

        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="flex flex-col items-center gap-2">
              <Bone className="size-14 rounded-[18px]" />
              <Bone className="h-2.5 w-11 rounded-full" />
            </div>
          ))}
        </div>

        <div className="grid gap-2.5">
          <div className="flex items-center justify-between">
            <Bone className="h-4 w-36" />
            <Bone className="h-3 w-14" />
          </div>
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="fintech-mobile-card flex items-center gap-3 px-3.5 py-3">
              <Bone className="size-11 shrink-0 rounded-2xl" />
              <div className="grid flex-1 gap-1.5">
                <Bone className="h-3.5 w-32" />
                <Bone className="h-2.5 w-20" />
              </div>
              <div className="grid justify-items-end gap-1.5">
                <Bone className="h-3.5 w-16" />
                <Bone className="h-2.5 w-12" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Skeleton (>= md) */}
      <div className="hidden gap-6 md:grid">
        <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <div key={index} className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-panel">
              <div className="flex items-center justify-between">
                <Bone className="size-9 rounded-lg" />
                <Bone className="h-5 w-16 rounded-lg" />
              </div>
              <Bone className="h-7 w-28" />
              <Bone className="h-3 w-24" />
            </div>
          ))}
        </div>

        <div className="grid gap-6 xl:grid-cols-[2fr_1fr]">
          <div className="grid gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-panel">
            <Bone className="h-4 w-44" />
            <div className="flex h-52 items-end gap-2">
              {[45, 70, 55, 85, 60, 95, 75, 50, 80, 65, 90, 70].map((height, index) => (
                <Bone key={index} className="flex-1 rounded-t-md rounded-b-none" style={{ height: `${height}%` }} />
              ))}
            </div>
          </div>
          <div className="grid content-start gap-4 rounded-xl border border-border/80 bg-card p-4 shadow-panel">
            <Bone className="h-4 w-32" />
            {Array.from({ length: 5 }, (_, index) => (
              <div key={index} className="flex items-center gap-3">
                <Bone className="size-7 rounded-lg" />
                <Bone className="h-3.5 flex-1" />
                <Bone className="h-3 w-14" />
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-3 rounded-xl border border-border/80 bg-card p-4 shadow-panel">
          <Bone className="h-4 w-40" />
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-t border-border/60 pt-3">
              <Bone className="h-3 w-16" />
              <Bone className="h-3 flex-1" />
              <Bone className="h-3 w-24" />
              <Bone className="h-3 w-16" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
