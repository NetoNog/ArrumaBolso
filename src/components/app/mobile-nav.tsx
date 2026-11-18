"use client";

import { CreditCard, LayoutDashboard, ListChecks, Menu, Plus, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { useFinance } from "@/lib/store/finance-store";

interface Tab {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LEFT_TABS: readonly Tab[] = [
  { href: "/", label: "Início", icon: LayoutDashboard },
  { href: "/lancamentos", label: "Lançamentos", icon: ListChecks },
];
const RIGHT_TABS: readonly Tab[] = [{ href: "/faturas", label: "Faturas", icon: CreditCard }];
const TAB_HREFS = new Set([...LEFT_TABS, ...RIGHT_TABS].map((tab) => tab.href));

const ITEM_CLASS =
  "flex flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors active:scale-95 [transition-property:color,transform] duration-150";

/**
 * Bottom tab bar for phones and tablets (below `lg`, where the sidebar is hidden).
 * The centre action creates an expense; "Mais" opens the full navigation drawer.
 */
export function MobileNav({ onOpenMenu }: { onOpenMenu: () => void }) {
  const pathname = usePathname();
  const { openCreate } = useDialogs();
  const { selectedMonth } = useFinance();
  const moreActive = !TAB_HREFS.has(pathname);

  return (
    <nav
      aria-label="Navegação inferior"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/90 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur supports-[backdrop-filter]:bg-background/75 lg:hidden"
    >
      <div className="mx-auto flex h-16 max-w-xl items-stretch px-2">
        {LEFT_TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
        ))}

        <div className="flex flex-1 items-center justify-center">
          <button
            type="button"
            aria-label="Novo gasto"
            onClick={() => openCreate({ invoice_month: selectedMonth })}
            className="flex size-12 items-center justify-center rounded-2xl bg-brand text-white shadow-lg shadow-blue-600/30 transition-transform duration-150 active:scale-90"
          >
            <Plus className="size-6" />
          </button>
        </div>

        {RIGHT_TABS.map((tab) => (
          <TabLink key={tab.href} tab={tab} active={pathname === tab.href} />
        ))}

        <button
          type="button"
          onClick={onOpenMenu}
          aria-current={moreActive ? "page" : undefined}
          className={cn(ITEM_CLASS, moreActive ? "text-brand" : "text-muted-foreground")}
        >
          <Menu className="size-5" />
          Mais
        </button>
      </div>
    </nav>
  );
}

function TabLink({ tab, active }: { tab: Tab; active: boolean }) {
  const Icon = tab.icon;
  return (
    <Link
      href={tab.href}
      aria-current={active ? "page" : undefined}
      className={cn(ITEM_CLASS, active ? "text-brand" : "text-muted-foreground")}
    >
      <Icon className="size-5" />
      {tab.label}
    </Link>
  );
}
