"use client";

import { AlertTriangle } from "lucide-react";
import { usePathname } from "next/navigation";
import { cn } from "cn";
import { useEffect, useState, type ReactNode } from "react";

import { AppSkeleton } from "@/components/app/app-skeleton";
import { DialogsProvider, useDialogs } from "@/components/app/dialogs-provider";
import { Header } from "@/components/app/header";
import { MobileMenuSheet } from "@/components/app/mobile-menu-sheet";
import { MobileNav } from "@/components/app/mobile-nav";
import { OfflineBanner, PullToRefresh, TopProgressBar } from "@/components/app/navigation-ux";
import { PrivacyProvider } from "@/components/app/privacy-provider";
import { PwaInstallBanner } from "@/components/app/pwa-install-banner";
import { PwaInstallProvider } from "@/components/app/pwa-install-provider";
import { useUserTheme } from "@/components/app/theme-provider";
import { Sidebar } from "@/components/app/sidebar";
import { SIDEBAR_WIDTH, SidebarStateProvider, useSidebarState } from "@/components/app/sidebar-state";
import { Button } from "@/components/ui/button";
import { FinanceProvider, useFinance } from "@/lib/store/finance-store";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <FinanceProvider>
      <PrivacyProvider>
        <DialogsProvider>
          <SidebarStateProvider>
            <PwaInstallProvider>
              <ShellLayout>{children}</ShellLayout>
            </PwaInstallProvider>
          </SidebarStateProvider>
        </DialogsProvider>
      </PrivacyProvider>
    </FinanceProvider>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status, error, state, selectedMonth, selectedCardId } = useFinance();
  const sidebar = useSidebarState();
  const sidebarWidth = sidebar.collapsed ? SIDEBAR_WIDTH.collapsed : SIDEBAR_WIDTH.expanded;
  // The user's own theme, applied only once their settings are loaded.
  useUserTheme(status === "ready" ? state.settings.theme : null);
  useGlobalShortcuts();

  // Always start at the top when switching primary screens.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "instant" });
  }, [pathname]);

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <TopProgressBar />
      {/*
        Sidebar and content offset glide together on the same spring-like ease-out curve;
        charts debounce ResizeObserver so the 280ms slide stays locked at 60/120fps.
      */}
      <aside
        style={{ width: sidebarWidth }}
        className={cn(
          "fixed inset-y-0 left-0 z-40 hidden border-r lg:block",
          sidebar.animate &&
            "transition-[width] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] will-change-[width] motion-reduce:transition-none",
        )}
      >
        <Sidebar layoutGroupId="sidebar-desktop" collapsed={sidebar.collapsed} onToggleCollapsed={sidebar.toggle} />
      </aside>
      <MobileMenuSheet open={mobileOpen} onOpenChange={setMobileOpen} />

      <div
        className={cn(
          sidebar.collapsed ? "lg:pl-[60px]" : "lg:pl-[250px]",
          sidebar.animate &&
            "lg:transition-[padding-left] lg:duration-[280ms] lg:ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
        )}
      >
        <Header />
        <OfflineBanner />
        <PwaInstallBanner />
        <PullToRefresh>
          <main className="pb-bottom-nav px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-6">
            {status === "loading" ? (
              <AppSkeleton />
            ) : status === "error" ? (
              <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-panel">
                <AlertTriangle className="size-6 text-negative" />
                <p className="font-medium">Não foi possível carregar os dados</p>
                <p className="text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" onClick={() => window.location.reload()}>
                  Tentar novamente
                </Button>
              </div>
            ) : (
              // Smooth entrance on route switch + subtle refresh pulse on month/card change.
              <div
                key={pathname}
                data-cycle={`${selectedMonth}-${selectedCardId ?? "all"}`}
                className="motion-safe:animate-[ab-page-enter_170ms_var(--ease-out-strong)]"
              >
                {children}
              </div>
            )}
          </main>
        </PullToRefresh>
      </div>
      <MobileNav onOpenMenu={() => setMobileOpen(true)} />
    </div>
  );
}

/** `/` and Cmd/Ctrl+K open the global search, unless the user is typing. */
function useGlobalShortcuts() {
  const { openSearch } = useDialogs();
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.isContentEditable || target?.tagName === "INPUT" || target?.tagName === "TEXTAREA" || target?.tagName === "SELECT";
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      } else if (event.key === "/" && !typing) {
        event.preventDefault();
        openSearch();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [openSearch]);
}
