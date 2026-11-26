"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "cn";

/**
 * Pure-CSS spring-animated Sun ↔ Moon icon (zero hydration mismatch, GPU-only
 * `transform` + `opacity` transitions). Connects the clicked button physically
 * to the screen-wide theme transition.
 */
export function ThemeToggleIcon({
  className,
  sunClassName,
  moonClassName,
}: {
  className?: string;
  sunClassName?: string;
  moonClassName?: string;
}) {
  return (
    <span className={cn("relative inline-flex size-4 items-center justify-center", className)} aria-hidden>
      <Sun
        className={cn(
          "absolute inset-0 size-full -rotate-90 scale-0 opacity-0 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none dark:rotate-0 dark:scale-100 dark:opacity-100",
          sunClassName,
        )}
      />
      <Moon
        className={cn(
          "absolute inset-0 size-full rotate-0 scale-100 opacity-100 transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] motion-reduce:transition-none dark:rotate-90 dark:scale-0 dark:opacity-0",
          moonClassName,
        )}
      />
    </span>
  );
}

