"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Defers mounting heavy below-the-fold widgets (Recharts graphs, dense tables)
 * until the user scrolls within `rootMargin` of them, slashing initial DOM size,
 * forced reflows, and Total Blocking Time while reserving `minHeight` to avoid CLS.
 */
export function DeferUntilVisible({
  children,
  minHeight = 320,
  rootMargin = "240px 0px",
  fallback,
}: {
  children: ReactNode;
  minHeight?: number;
  rootMargin?: string;
  fallback?: ReactNode;
}) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (visible) return;
    const node = hostRef.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      const id = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(id);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [visible, rootMargin]);

  if (visible) return <>{children}</>;

  return (
    <div ref={hostRef} style={{ minHeight }} aria-hidden>
      {fallback ?? <div className="ab-shimmer h-full w-full rounded-2xl border border-border/60 md:rounded-xl" style={{ minHeight }} />}
    </div>
  );
}

