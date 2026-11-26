"use client";

import { ArrowDown, Loader2, WifiOff } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode, type TouchEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useFinance } from "@/lib/store/finance-store";

const PULL_THRESHOLD = 56;
const MAX_PULL = 86;

/**
 * Ultra-thin 2px brand progress bar at the very top of the screen.
 * Appears only if a route switch takes > 110ms, giving instant confirmation that
 * the tap registered without flashing during instant prefetched transitions.
 */
export function TopProgressBar() {
  const pathname = usePathname();
  const [pendingPath, setPendingPath] = useState<string | null>(null);
  const currentPathRef = useRef(pathname);
  useEffect(() => {
    currentPathRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    let showTimer: ReturnType<typeof setTimeout> | null = null;
    let clearTimer: ReturnType<typeof setTimeout> | null = null;

    function onClick(event: MouseEvent) {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as HTMLElement | null)?.closest("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href");
      if (!href || !href.startsWith("/") || href.startsWith("//")) return;
      const nextPath = href.split(/[?#]/)[0];
      if (!nextPath || nextPath === currentPathRef.current) return;

      if (showTimer) clearTimeout(showTimer);
      if (clearTimer) clearTimeout(clearTimer);
      showTimer = setTimeout(() => {
        if (currentPathRef.current !== nextPath) {
          setPendingPath(nextPath);
          clearTimer = setTimeout(() => setPendingPath(null), 6000);
        }
      }, 110);
    }

    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("click", onClick, true);
      if (showTimer) clearTimeout(showTimer);
      if (clearTimer) clearTimeout(clearTimer);
    };
  }, []);

  const visible = pendingPath !== null && pendingPath !== pathname;

  return (
    <div
      aria-hidden={!visible}
      className={cn(
        "pointer-events-none fixed inset-x-0 top-0 z-50 h-[2.5px] overflow-hidden transition-opacity duration-200",
        visible ? "opacity-100" : "opacity-0",
      )}
    >
      <div
        className={cn(
          "h-full w-full bg-gradient-to-r from-transparent via-brand to-transparent will-change-transform",
          visible && "animate-[ab-shimmer_1.1s_linear_infinite]",
        )}
      />
    </div>
  );
}

/** Compact banner shown whenever the device loses network connectivity. */
export function OfflineBanner() {
  const { isOffline } = useFinance();
  if (!isOffline) return null;
  return (
    <div
      role="status"
      className="mx-4 mt-2 flex items-center justify-center gap-2 rounded-2xl border border-warning/30 bg-warning-soft px-3.5 py-2 text-xs font-medium text-warning sm:mx-6 lg:mx-8"
    >
      <WifiOff className="size-3.5 shrink-0" />
      <span>Sem conexão — exibindo dados salvos localmente</span>
    </div>
  );
}

/**
 * Native-style mobile Pull-to-Refresh wrapper around the main content area.
 * Activates only on touch devices when scrolled to the top (`scrollY <= 0`)
 * and ignores horizontal swipes or touches inside dialogs/sheets.
 */
export function PullToRefresh({ children }: { children: ReactNode }) {
  const { reload, isOffline, isRefreshing } = useFinance();
  const [pull, setPull] = useState(0);
  const [releasing, setReleasing] = useState(false);
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const activeRef = useRef(false);

  function onTouchStart(event: TouchEvent<HTMLDivElement>) {
    if (isRefreshing || window.scrollY > 2) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest('[role="dialog"], [data-slot="sheet-content"], [data-no-ptr]')) return;
    const touch = event.touches[0];
    if (!touch) return;
    startRef.current = { x: touch.clientX, y: touch.clientY };
    activeRef.current = false;
  }

  function onTouchMove(event: TouchEvent<HTMLDivElement>) {
    if (!startRef.current || window.scrollY > 2) return;
    const touch = event.touches[0];
    if (!touch) return;
    const dx = touch.clientX - startRef.current.x;
    const dy = touch.clientY - startRef.current.y;

    if (!activeRef.current) {
      if (Math.abs(dx) > Math.abs(dy) || dy < 12) {
        if (Math.abs(dx) > 12 || dy < -8) startRef.current = null;
        return;
      }
      activeRef.current = true;
    }

    const damped = Math.min(MAX_PULL, Math.max(0, (dy - 12) * 0.45));
    setPull(damped);
  }

  async function onTouchEnd() {
    const shouldRefresh = activeRef.current && pull >= PULL_THRESHOLD;
    startRef.current = null;
    activeRef.current = false;

    if (!shouldRefresh) {
      setPull(0);
      return;
    }

    if (isOffline) {
      setPull(0);
      toast("Sem conexão com a internet", { description: "Exibindo seus dados salvos localmente." });
      return;
    }

    setReleasing(true);
    setPull(44);
    const updated = await reload({ force: true });
    setReleasing(false);
    setPull(0);
    if (updated) toast.success("Dados atualizados");
  }

  const ready = pull >= PULL_THRESHOLD;
  const visible = pull > 6 || releasing;

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={() => void onTouchEnd()} onTouchCancel={() => setPull(0)}>
      <div
        aria-hidden={!visible}
        style={{ height: visible ? `${Math.round(pull)}px` : "0px" }}
        className="flex items-center justify-center overflow-hidden transition-[height] duration-150 ease-out lg:hidden"
      >
        <div
          className={cn(
            "flex items-center gap-1.5 rounded-full border border-border/80 bg-card px-3 py-1 text-xs font-medium shadow-panel transition-colors",
            ready || releasing ? "border-brand/30 text-brand" : "text-muted-foreground",
          )}
        >
          {releasing ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              <span>Atualizando...</span>
            </>
          ) : (
            <>
              <ArrowDown className={cn("size-3.5 transition-transform duration-150", ready && "rotate-180")} />
              <span>{ready ? "Solte para atualizar" : "Puxe para atualizar"}</span>
            </>
          )}
        </div>
      </div>
      {children}
    </div>
  );
}

