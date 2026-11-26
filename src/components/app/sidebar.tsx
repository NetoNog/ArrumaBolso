"use client";

import { Download, PanelLeftClose, Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactElement, ReactNode } from "react";
import { cn } from "cn";

import { ThemeToggleIcon } from "@/components/common/theme-toggle-icon";
import { UserAvatar } from "@/components/common/user-avatar";
import { BrandLogo } from "@/components/brand/logo";
import { NAV_GROUPS, SETTINGS_ITEM, type NavBadgeKey, type NavItem } from "@/components/app/navigation";
import { SignOutButton } from "@/components/app/sign-out-button";
import { useDialogs } from "@/components/app/dialogs-provider";
import { usePwaInstall } from "@/components/app/pwa-install-provider";
import { useThemeMode } from "@/components/app/theme-provider";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { updateSettings } from "@/lib/domain/operations";
import { activeInstallmentGroups } from "@/lib/finance/metrics";
import { useFinance } from "@/lib/store/finance-store";

/** Labels fade + tuck horizontally with asymmetric delay so text never clips harshly on collapse. */
const LABEL_FADE =
  "transition-[opacity,transform] duration-[220ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none";

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapsed,
}: {
  onNavigate?: () => void;
  /** Icon-only rail (desktop only). */
  collapsed?: boolean;
  /** Shows the collapse button when provided. */
  onToggleCollapsed?: () => void;
  /** Kept optional for backwards compatibility. */
  layoutGroupId?: string;
}) {
  const pathname = usePathname();
  const { state, status, currentMonth, userEmail, commit } = useFinance();
  const { openSearch } = useDialogs();
  const { installed: pwaInstalled, canPromptNative, triggerInstall } = usePwaInstall();
  const { toggleLightDark } = useThemeMode();
  const ready = status === "ready";

  const badges: Record<NavBadgeKey, number> = {
    installments: activeInstallmentGroups(state, currentMonth).length,
    subscriptions: state.recurring_subscriptions.filter((sub) => sub.active).length,
  };
  const labelClass = cn(
    LABEL_FADE,
    collapsed ? "pointer-events-none -translate-x-2 opacity-0 delay-0" : "translate-x-0 opacity-100 delay-[55ms]",
  );

  return (
    <div className="flex h-full flex-col overflow-hidden bg-sidebar pt-[env(safe-area-inset-top,0px)] pb-[env(safe-area-inset-bottom,0px)] whitespace-nowrap text-sidebar-foreground">
        {/* The symbol is the logo's left edge: smoothly clipping the wordmark leaves it centred on the rail. */}
        <div className="flex items-center px-[19px] pt-5 pb-4">
          <Link
            href="/"
            onClick={onNavigate}
            aria-label="ArrumaBolso — Visão Geral"
            className={cn(
              "block overflow-hidden rounded-md transition-[width] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              collapsed ? "w-[22px]" : "w-[152px]",
            )}
          >
            <BrandLogo height={22} />
          </Link>
        </div>

        <div className="px-3 pb-3">
          <WithTooltip label="Buscar" enabled={collapsed}>
            <button
              type="button"
              aria-label="Buscar lançamento ou loja"
              onClick={() => {
                onNavigate?.();
                openSearch();
              }}
              className="flex h-9 w-full items-center gap-2 overflow-hidden rounded-lg border border-border/80 bg-surface-subtle px-2.5 text-left text-sm text-muted-foreground transition-colors hover:border-brand/30 hover:text-foreground"
            >
              <Search className="size-4 shrink-0" />
              <span className={cn("flex-1 truncate", labelClass)}>Buscar lançamento ou loja...</span>
              <kbd className={cn("num rounded border bg-card px-1.5 text-[10px] text-muted-foreground", labelClass)}>/</kbd>
            </button>
          </WithTooltip>
        </div>

        <nav className="flex-1 overflow-x-hidden overflow-y-auto px-3" aria-label="Navegação principal">
          {NAV_GROUPS.map((group, index) => (
            <div key={group.label} className="pb-4">
              {/* overflow-hidden: long labels must not widen the scroll area of the 60px rail. */}
              <div className="relative h-6 overflow-hidden">
                <p className={cn("px-2 text-[10.5px] leading-6 font-semibold tracking-wider text-muted-foreground uppercase", labelClass)}>
                  {group.label}
                </p>
                {/* Same height as the label, so items keep their place while the rail collapses. */}
                {index > 0 ? (
                  <span
                    aria-hidden
                    className={cn(
                      "absolute inset-x-1.5 top-1/2 h-px bg-border opacity-0",
                      LABEL_FADE,
                      collapsed && "opacity-100",
                    )}
                  />
                ) : null}
              </div>
              {/* grid-cols-1 = minmax(0, 1fr): labels never stretch a link past the rail. */}
              <ul className="grid grid-cols-1 gap-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <NavLink
                      item={item}
                      active={pathname === item.href}
                      badge={item.badge ? badges[item.badge] : undefined}
                      collapsed={collapsed}
                      onNavigate={onNavigate}
                    />
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>

        <div className="grid grid-cols-1 gap-1 border-t px-3 py-3">
          {!pwaInstalled && canPromptNative ? (
            <WithTooltip label="Instalar como App" enabled={collapsed}>
              <button
                type="button"
                onClick={() => void triggerInstall()}
                aria-label="Instalar ArrumaBolso como App"
                className="flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg border border-brand/20 bg-brand-soft px-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand/15"
              >
                <Download className="size-4 shrink-0" />
                <span className={labelClass}>Instalar como App</span>
              </button>
            </WithTooltip>
          ) : null}
          {onToggleCollapsed ? (
            <WithTooltip label="Expandir menu" enabled={collapsed}>
              <button
                type="button"
                onClick={onToggleCollapsed}
                aria-expanded={!collapsed}
                aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
                className="flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
              >
                <PanelLeftClose
                  className={cn(
                    "size-4 shrink-0 transition-transform duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
                    collapsed && "rotate-180",
                  )}
                />
                <span className={labelClass}>Recolher menu</span>
              </button>
            </WithTooltip>
          ) : null}
          <WithTooltip label="Alternar tema" enabled={collapsed}>
            <button
              type="button"
              disabled={!ready}
              aria-label="Alternar tema claro/escuro"
              onClick={(event) => {
                toggleLightDark(event, (next) => {
                  commit((current) => updateSettings(current, { theme: next }));
                });
              }}
              className="flex h-9 w-full items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-sm font-medium text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
            >
              <ThemeToggleIcon className="size-4 shrink-0" sunClassName="text-amber-400" />
              <span className={cn(labelClass, "hidden dark:inline")}>Tema claro</span>
              <span className={cn(labelClass, "dark:hidden")}>Tema escuro</span>
            </button>
          </WithTooltip>
          <NavLink item={SETTINGS_ITEM} active={pathname === SETTINGS_ITEM.href} collapsed={collapsed} onNavigate={onNavigate} />

          <div
            className={cn(
              "mt-1 flex items-center gap-2.5 overflow-hidden rounded-xl border transition-[padding,background-color,border-color] duration-[280ms] ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              collapsed ? "border-transparent bg-transparent p-px" : "border-border/80 bg-surface-subtle p-2",
            )}
          >
            {ready ? (
              <UserAvatar
                name={state.settings.display_name}
                style={state.settings.avatar_style}
                seed={state.settings.avatar_seed}
                size={32}
              />
            ) : (
              <span className="size-8 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" aria-hidden />
            )}
            <div className={cn("min-w-0 flex-1", labelClass)}>
              {ready ? (
                <>
                  <p className="truncate text-sm font-medium text-foreground">{state.settings.display_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{userEmail ?? "Controle Pessoal"}</p>
                </>
              ) : (
                <div className="grid gap-1.5" aria-hidden>
                  <span className="h-3 w-24 rounded bg-muted motion-safe:animate-pulse" />
                  <span className="h-2.5 w-32 rounded bg-muted motion-safe:animate-pulse" />
                </div>
              )}
            </div>
          </div>
          {onNavigate ? (
            <div className="pt-1 lg:hidden">
              <SignOutButton className="h-9 w-full justify-center rounded-xl" />
            </div>
          ) : null}
        </div>
      </div>
  );
}

/** Tooltip with the label of an icon-only control (collapsed rail only). */
function WithTooltip({ label, enabled, children }: { label: string; enabled: boolean; children: ReactElement }) {
  if (!enabled) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
    </Tooltip>
  );
}

function NavLink({
  item,
  active,
  badge,
  collapsed,
  onNavigate,
}: {
  item: NavItem;
  active: boolean;
  badge?: number;
  collapsed: boolean;
  onNavigate?: () => void;
}) {
  const hasBadge = badge !== undefined && badge > 0;
  const content: ReactNode = (
    <>
      {active ? (
        <span aria-hidden className="absolute inset-0 rounded-lg border border-brand/15 bg-nav-active transition-colors" />
      ) : null}
      <span className="relative">
        <item.icon className="size-4 shrink-0" />
        {/* Smoothly scales in on the collapsed rail when a badge count exists. */}
        {hasBadge ? (
          <span
            className={cn(
              "absolute -top-1 -right-1 size-2 rounded-full bg-brand ring-2 ring-sidebar transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
              collapsed ? "scale-100 opacity-100 delay-[90ms]" : "pointer-events-none scale-0 opacity-0 delay-0",
            )}
          />
        ) : null}
      </span>
      <span
        className={cn(
          "relative min-w-0 flex-1 truncate",
          hasBadge && !collapsed && "pr-7",
          LABEL_FADE,
          collapsed ? "pointer-events-none -translate-x-2 opacity-0 delay-0" : "translate-x-0 opacity-100 delay-[55ms]",
        )}
      >
        {item.label}
      </span>
      {/* Positioned absolutely so it cross-fades smoothly without ever widening the 36px collapsed rail. */}
      {hasBadge ? (
        <span
          className={cn(
            "num absolute right-2 inline-flex h-5 min-w-5 items-center justify-center rounded-md px-1 text-xs font-semibold transition-[opacity,transform] duration-200 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none",
            active ? "bg-brand/15 text-brand" : "bg-muted text-muted-foreground",
            collapsed ? "pointer-events-none scale-75 opacity-0 delay-0" : "scale-100 opacity-100 delay-[70ms]",
          )}
        >
          {badge}
        </span>
      ) : null}
    </>
  );

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      aria-label={collapsed ? item.label : undefined}
      className={cn(
        "relative flex h-9 items-center gap-2.5 overflow-hidden rounded-lg px-2.5 text-sm font-medium transition-colors",
        active ? "text-nav-active-foreground" : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      {content}
    </Link>
  );

  return (
    <WithTooltip label={hasBadge ? `${item.label} (${badge})` : item.label} enabled={collapsed}>
      {link}
    </WithTooltip>
  );
}
