"use client";

import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";

import { DialogsProvider, useDialogs } from "@/components/app/dialogs-provider";
import { Header } from "@/components/app/header";
import { MobileNav } from "@/components/app/mobile-nav";
import { Sidebar } from "@/components/app/sidebar";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { FinanceProvider, useFinance } from "@/lib/store/finance-store";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <FinanceProvider>
      <DialogsProvider>
        <ShellLayout>{children}</ShellLayout>
      </DialogsProvider>
    </FinanceProvider>
  );
}

function ShellLayout({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { status, error } = useFinance();
  useGlobalShortcuts();

  return (
    <div className="min-h-screen bg-background">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[250px] border-r lg:block">
        <Sidebar />
      </aside>
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-[280px] max-w-[85vw] p-0" showCloseButton={false}>
          <SheetTitle className="sr-only">Menu</SheetTitle>
          <Sidebar onNavigate={() => setMobileOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="lg:pl-[250px]">
        <Header />
        <main className="pb-bottom-nav px-4 pt-4 sm:px-6 sm:pt-6 lg:px-8 lg:pb-6">
          {status === "loading" ? (
            <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-sm text-muted-foreground">
              <Loader2 className="size-5 animate-spin" />
              Carregando seus dados financeiros...
            </div>
          ) : status === "error" ? (
            <div className="mx-auto flex max-w-md flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-panel">
              <AlertTriangle className="size-6 text-rose-500" />
              <p className="font-medium">Não foi possível carregar os dados</p>
              <p className="text-sm text-muted-foreground">{error}</p>
              <Button variant="outline" onClick={() => window.location.reload()}>
                Tentar novamente
              </Button>
            </div>
          ) : (
            children
          )}
        </main>
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
