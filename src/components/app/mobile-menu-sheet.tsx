"use client";

import {
  CalendarRange,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  CloudOff,
  CreditCard,
  Download,
  Eye,
  EyeOff,
  ListChecks,
  Loader2,
  PawPrint,
  Repeat,
  Search,
  Settings,
  Target,
  Upload,
  Wallet,
  Wand2,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { usePwaInstall } from "@/components/app/pwa-install-provider";
import { SignOutButton } from "@/components/app/sign-out-button";
import { useThemeMode } from "@/components/app/theme-provider";
import { ThemeToggleIcon } from "@/components/common/theme-toggle-icon";
import { UserAvatar } from "@/components/common/user-avatar";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { updateSettings } from "@/lib/domain/operations";
import { activeInstallmentGroups, expensesOfMonth, transactionsOfMonth } from "@/lib/finance/metrics";
import { useFinance } from "@/lib/store/finance-store";

interface QuickModuleCard {
  href: string;
  label: string;
  badge: string;
  badgeAlert?: boolean;
  icon: LucideIcon;
  tileClass: string;
}

interface ToolRow {
  href?: string;
  onClick?: () => void;
  label: string;
  description: string;
  icon: LucideIcon;
}

/**
 * Native-style mobile Menu Hub (bottom sheet):
 * profile card + 1-tap theme/privacy/search controls + 2x3 pastel module grid
 * with live counters + touch-sized (48px) planning/tools list + sync status & sign out.
 */
export function MobileMenuSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const pathname = usePathname();
  const { state, status, currentMonth, selectedMonth, userEmail, commit, syncStatus, retrySync } = useFinance();
  const { openSearch, openImport } = useDialogs();
  const { hidden, toggle: togglePrivacy } = usePrivacy();
  const { installed: pwaInstalled, canPromptNative, isIos, triggerInstall } = usePwaInstall();
  const { toggleLightDark } = useThemeMode();
  const ready = status === "ready";
  const close = () => onOpenChange(false);

  const monthTxCount = transactionsOfMonth(state, selectedMonth).length;
  const activeInstallments = activeInstallmentGroups(state, currentMonth).length;
  const activeSubs = state.recurring_subscriptions.filter((sub) => sub.active).length;
  const activePets = (state.pets ?? []).filter((pet) => !pet.is_archived).length;
  const uncategorizedCount = expensesOfMonth(state, selectedMonth).filter((tx) => !tx.category_id).length;

  const modules: QuickModuleCard[] = [
    {
      href: "/lancamentos",
      label: "Lançamentos",
      badge: `${monthTxCount} no ciclo`,
      icon: ListChecks,
      tileClass: "tile-blue",
    },
    {
      href: "/faturas",
      label: "Faturas",
      badge: activeInstallments > 0 ? `${activeInstallments} parcel.` : `${state.cards.length} cartão(ões)`,
      icon: CreditCard,
      tileClass: "tile-violet",
    },
    {
      href: "/orcamento",
      label: "Orçamento",
      badge: `${state.categories.length} categorias`,
      icon: Target,
      tileClass: "tile-emerald",
    },
    {
      href: "/meu-pet",
      label: "Meu Pet",
      badge: activePets > 0 ? `${activePets} pet(s)` : "Cadastrar pet",
      icon: PawPrint,
      tileClass: "tile-amber",
    },
    {
      href: "/fechamento",
      label: "Fechamento",
      badge: uncategorizedCount > 0 ? `${uncategorizedCount} pendente(s)` : "Em dia ✓",
      badgeAlert: uncategorizedCount > 0,
      icon: ClipboardCheck,
      tileClass: "tile-cyan",
    },
    {
      href: "/assinaturas",
      label: "Assinaturas",
      badge: `${activeSubs} ativa(s)`,
      icon: Repeat,
      tileClass: "tile-rose",
    },
  ];

  const tools: ToolRow[] = [
    {
      onClick: () => {
        close();
        openImport();
      },
      label: "Importar extrato (CSV / OFX)",
      description: "Cartões de crédito e conta corrente",
      icon: Upload,
    },
    {
      href: "/renda",
      label: "Salário & Renda",
      description: "Fontes mensais, 13º, PLR e histórico",
      icon: Wallet,
    },
    {
      href: "/projecao",
      label: "Projeção 12 Meses",
      description: "Fluxo futuro e simulador “Cabe no bolso?”",
      icon: CalendarRange,
    },
    {
      href: "/regras",
      label: "Regras de Limpeza",
      description: "Auto-categorização e nomes limpos",
      icon: Wand2,
    },
    {
      href: "/configuracoes",
      label: "Configurações",
      description: "Perfil, cores, cartões, ciclo da fatura e backup",
      icon: Settings,
    },
    ...(!pwaInstalled
      ? [
          {
            onClick: () => {
              close();
              void triggerInstall();
            },
            label: "Instalar como App",
            description: canPromptNative
              ? "Instalação rápida em 1 toque na tela inicial"
              : isIos
                ? "Ver passo a passo (2 toques no Safari)"
                : "Adicionar atalho de aplicativo no aparelho",
            icon: Download,
          },
        ]
      : []),
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        className="max-h-[90dvh] gap-4 overflow-y-auto overscroll-contain rounded-t-[28px] border-t-0 bg-background px-4 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))] shadow-2xl"
      >
        <SheetTitle className="sr-only">Menu de navegação</SheetTitle>

        {/* Top drag pill + close button */}
        <div className="relative flex items-center justify-center pb-0.5">
          <span aria-hidden className="h-1 w-10 rounded-full bg-muted-foreground/30" />
          <button
            type="button"
            onClick={close}
            aria-label="Fechar menu"
            className="absolute right-0 flex size-8 items-center justify-center rounded-full bg-card text-muted-foreground shadow-panel transition-transform active:scale-90"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Profile Card */}
        <Link
          href="/configuracoes"
          onClick={close}
          className="fintech-mobile-card flex items-center gap-3.5 border border-border/60 p-3.5 transition-transform active:scale-[0.99]"
        >
          {ready ? (
            <UserAvatar
              name={state.settings.display_name}
              style={state.settings.avatar_style}
              seed={state.settings.avatar_seed}
              size={48}
            />
          ) : (
            <span className="size-12 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" aria-hidden />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold tracking-tight text-foreground">
              {ready ? state.settings.display_name : "Carregando..."}
            </p>
            <p className="truncate text-xs text-muted-foreground">{userEmail ?? "Controle Pessoal"}</p>
          </div>
          <span className="flex items-center gap-0.5 text-xs font-semibold text-brand">
            Perfil <ChevronRight className="size-4" />
          </span>
        </Link>

        {/* 1-Tap Quick Controls: Theme, Privacy, Global Search */}
        <div className="grid grid-cols-3 gap-2">
          <button
            type="button"
            disabled={!ready}
            onClick={(event) => {
              toggleLightDark(event, (next) => {
                commit((current) => updateSettings(current, { theme: next }));
              });
            }}
            className="fintech-mobile-card flex h-11 items-center justify-center gap-1.5 border border-border/60 px-2 text-xs font-semibold text-foreground transition-transform active:scale-95"
          >
            <ThemeToggleIcon sunClassName="text-amber-400" moonClassName="text-brand" />
            <span className="hidden dark:inline">Claro</span>
            <span className="dark:hidden">Escuro</span>
          </button>

          <button
            type="button"
            onClick={togglePrivacy}
            aria-pressed={hidden}
            className={cn(
              "fintech-mobile-card flex h-11 items-center justify-center gap-1.5 border px-2 text-xs font-semibold transition-transform active:scale-95",
              hidden ? "border-brand/60 bg-brand/10 text-brand" : "border-border/60 text-foreground",
            )}
          >
            {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4 text-muted-foreground" />}
            <span>{hidden ? "Oculto" : "Valores"}</span>
          </button>

          <button
            type="button"
            onClick={() => {
              close();
              openSearch();
            }}
            className="fintech-mobile-card flex h-11 items-center justify-center gap-1.5 border border-border/60 px-2 text-xs font-semibold text-foreground transition-transform active:scale-95"
          >
            <Search className="size-4 text-muted-foreground" />
            <span>Buscar</span>
          </button>
        </div>

        {/* Main Modules 2x3 Grid */}
        <section className="grid gap-2">
          <p className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Módulos
          </p>
          <div className="grid grid-cols-2 gap-2.5">
            {modules.map((mod) => {
              const Icon = mod.icon;
              const active = pathname === mod.href;
              return (
                <Link
                  key={mod.href}
                  href={mod.href}
                  prefetch
                  onClick={close}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "fintech-mobile-card flex items-center gap-3 border p-3 transition-transform active:scale-[0.98]",
                    active ? "border-brand bg-brand/5 ring-1 ring-brand/40" : "border-border/60",
                  )}
                >
                  <span className={cn("flex size-10 shrink-0 items-center justify-center rounded-2xl", mod.tileClass)}>
                    <Icon className="size-[18px]" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{mod.label}</p>
                    <p
                      className={cn(
                        "num truncate text-[11px]",
                        mod.badgeAlert ? "font-semibold text-warning" : "text-muted-foreground",
                      )}
                    >
                      {mod.badge}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Planning & Tools Touch List (48px rows) */}
        <section className="grid gap-2">
          <p className="px-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase">
            Planejamento & ferramentas
          </p>
          <div className="fintech-mobile-card divide-y divide-border/60 overflow-hidden border border-border/60">
            {tools.map((row) => {
              const Icon = row.icon;
              const active = row.href ? pathname === row.href : false;
              const inner = (
                <>
                  <span
                    className={cn(
                      "flex size-9 shrink-0 items-center justify-center rounded-xl",
                      active ? "bg-brand text-white" : "bg-muted text-foreground",
                    )}
                  >
                    <Icon className="size-4" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-semibold text-foreground">{row.label}</span>
                    <span className="block truncate text-[11.5px] text-muted-foreground">{row.description}</span>
                  </span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </>
              );

              if (row.href) {
                return (
                  <Link
                    key={row.label}
                    href={row.href}
                    onClick={close}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[54px] items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-muted/60",
                      active && "bg-brand/5",
                    )}
                  >
                    {inner}
                  </Link>
                );
              }
              return (
                <button
                  key={row.label}
                  type="button"
                  onClick={row.onClick}
                  className="flex min-h-[54px] w-full items-center gap-3 px-3.5 py-2.5 transition-colors active:bg-muted/60"
                >
                  {inner}
                </button>
              );
            })}
          </div>
        </section>

        {/* Footer: Sync Status + Sign Out */}
        <div className="grid gap-2.5 pt-1">
          <div className="flex items-center justify-between rounded-2xl border border-border/60 bg-card px-3.5 py-2.5 text-xs">
            {syncStatus === "saving" ? (
              <span className="flex items-center gap-2 text-muted-foreground">
                <Loader2 className="size-3.5 animate-spin text-brand" /> Salvando alterações...
              </span>
            ) : syncStatus === "error" ? (
              <button type="button" onClick={retrySync} className="flex items-center gap-2 font-medium text-negative">
                <CloudOff className="size-3.5" /> Erro ao sincronizar • Toque para tentar
              </button>
            ) : (
              <span className="flex items-center gap-2 text-positive">
                <CheckCircle2 className="size-3.5" /> Dados sincronizados
              </span>
            )}
            <span className="text-[11px] text-muted-foreground">ArrumaBolso</span>
          </div>

          <SignOutButton className="h-11 w-full justify-center rounded-2xl" />
        </div>
      </SheetContent>
    </Sheet>
  );
}

