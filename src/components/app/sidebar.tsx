"use client";

import { Moon, Search, Sun } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTheme } from "next-themes";
import { cn } from "cn";

import { BrandLogo } from "@/components/brand/logo";
import { NAV_GROUPS, SETTINGS_ITEM, type NavBadgeKey, type NavItem } from "@/components/app/navigation";
import { useDialogs } from "@/components/app/dialogs-provider";
import { Button } from "@/components/ui/button";
import { activeInstallmentGroups } from "@/lib/finance/metrics";
import { useFinance } from "@/lib/store/finance-store";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "A") + (parts[1]?.[0] ?? "")).toUpperCase();
}

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const { state, currentMonth, userEmail } = useFinance();
  const { openSearch } = useDialogs();
  const { resolvedTheme, setTheme } = useTheme();

  const badges: Record<NavBadgeKey, number> = {
    installments: activeInstallmentGroups(state, currentMonth).length,
    subscriptions: state.recurring_subscriptions.filter((sub) => sub.active).length,
  };

  return (
    <div className="flex h-full flex-col bg-sidebar pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] text-sidebar-foreground">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <Link href="/" onClick={onNavigate} aria-label="ArrumaBolso — Visão Geral" className="rounded-md">
          <BrandLogo height={22} />
        </Link>
        <span className="ml-auto inline-flex h-5 items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 text-[10.5px] font-semibold text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
          <span className="size-1.5 rounded-full bg-emerald-500" />
          Ativo
        </span>
      </div>

      <div className="px-3 pb-3">
        <button
          type="button"
          onClick={() => {
            onNavigate?.();
            openSearch();
          }}
          className="flex h-9 w-full items-center gap-2 rounded-lg border bg-background px-2.5 text-left text-[13px] text-muted-foreground transition-colors hover:border-slate-300 dark:hover:border-zinc-600"
        >
          <Search className="size-3.5" />
          <span className="flex-1 truncate">Buscar lançamento ou loja...</span>
          <kbd className="num rounded border bg-card px-1.5 text-[10px] text-muted-foreground">/</kbd>
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3" aria-label="Navegação principal">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="pb-4">
            <p className="px-2 pb-1.5 text-[10.5px] font-semibold tracking-wider text-muted-foreground uppercase">{group.label}</p>
            <ul className="grid gap-0.5">
              {group.items.map((item) => (
                <li key={item.href}>
                  <NavLink item={item} active={pathname === item.href} badge={item.badge ? badges[item.badge] : undefined} onNavigate={onNavigate} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="grid gap-2 border-t px-3 py-3">
        <NavLink item={SETTINGS_ITEM} active={pathname === SETTINGS_ITEM.href} onNavigate={onNavigate} />
        <div className="flex items-center gap-2.5 rounded-lg border bg-background p-2">
          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-violet-500 text-xs font-semibold text-white">
            {initials(state.settings.display_name)}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-medium text-foreground">{state.settings.display_name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{userEmail ?? "Controle Pessoal"}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            // Static label: the resolved theme is unknown during SSR, so a theme-dependent
            // label would differ between server and client HTML (hydration mismatch).
            aria-label="Alternar tema claro/escuro"
            onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
          >
            <Sun className="hidden dark:block" />
            <Moon className="dark:hidden" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function NavLink({
  item,
  active,
  badge,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[13px] font-medium transition-colors",
        active ? "bg-nav-active text-nav-active-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {badge !== undefined && badge > 0 ? (
        <span
          className={cn(
            "num inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-[11px] font-semibold",
            active ? "bg-white/15 text-current" : "bg-muted text-muted-foreground",
          )}
        >
          {badge}
        </span>
      ) : null}
    </Link>
  );
}
