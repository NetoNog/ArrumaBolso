"use client";

import {
  AlertCircle,
  ArrowLeft,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Eye,
  EyeOff,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { NotificationCenter } from "@/components/app/notification-center";
import { usePrivacy } from "@/components/app/privacy-provider";
import { SignOutButton } from "@/components/app/sign-out-button";
import { findNavItem } from "@/components/app/navigation";
import { SimpleSelect } from "@/components/common/simple-select";
import { UserAvatar } from "@/components/common/user-avatar";
import { Button } from "@/components/ui/button";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { cardLabel } from "@/lib/import/issuers";
import { useFinance } from "@/lib/store/finance-store";
import { useIsLg } from "@/lib/use-media-query";

const ALL_CARDS = "__all_cards__";
const CARD_FILTER_ROUTES = new Set(["/", "/lancamentos", "/faturas", "/analises", "/projecao"]);
const NO_MONTH_ROUTES = new Set(["/configuracoes", "/regras", "/importar"]);

export function Header() {
  const pathname = usePathname();
  const item = findNavItem(pathname);
  const { openCreate, openImport, openSearch } = useDialogs();
  const { hidden, toggle: togglePrivacy } = usePrivacy();
  const { status, state, reload, isRefreshing } = useFinance();
  const isLg = useIsLg();
  const ready = status === "ready";
  const isHome = pathname === "/";
  const showMonthFilter = !NO_MONTH_ROUTES.has(pathname);
  const showCardFilter = CARD_FILTER_ROUTES.has(pathname);
  const firstName = state.settings.display_name.trim().split(/\s+/)[0] || "Olá";

  return (
    <header className="sticky top-0 z-30 bg-background/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur-md lg:border-b lg:bg-background/85">
      {/* Mobile Fintech Header (< lg) */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
          {isHome ? (
            <Link href="/configuracoes" className="flex min-w-0 items-center gap-3 active:opacity-80">
              {ready ? (
                <UserAvatar
                  name={state.settings.display_name}
                  style={state.settings.avatar_style}
                  seed={state.settings.avatar_seed}
                  size={40}
                />
              ) : (
                <span className="size-10 shrink-0 rounded-full bg-muted motion-safe:animate-pulse" aria-hidden />
              )}
              <div className="min-w-0">
                <p className="truncate text-xs text-muted-foreground">Olá, {ready ? firstName : "..."}</p>
                <p className="truncate text-base font-bold tracking-tight text-foreground">Bem-vindo de volta!</p>
              </div>
            </Link>
          ) : (
            <div className="flex min-w-0 flex-1 items-center gap-2.5">
              <Link
                href="/"
                aria-label="Voltar para início"
                className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-card text-foreground shadow-panel transition-transform active:scale-95"
              >
                <ArrowLeft className="size-4" />
              </Link>
              <h1 className="truncate text-base font-bold tracking-tight text-foreground">{item.label}</h1>
            </div>
          )}

          <div className={cn("flex shrink-0 items-center gap-1.5", !ready && "invisible")}>
            <SyncIndicator />
            <Button
              variant="ghost"
              size="icon"
              onClick={togglePrivacy}
              aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
              aria-pressed={hidden}
              className="size-10 rounded-2xl bg-card shadow-panel hover:bg-card"
            >
              {hidden ? <EyeOff className="size-[18px] text-brand" /> : <Eye className="size-[18px] text-foreground" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={openSearch}
              aria-label="Buscar lançamentos"
              className="size-10 rounded-2xl bg-card shadow-panel hover:bg-card"
            >
              <Search className="size-[18px] text-foreground" />
            </Button>
            {!isLg ? <NotificationCenter mobile /> : null}
          </div>
        </div>

        {/* Context-aware pill selectors on mobile (only where month/card filters actually apply) */}
        {showMonthFilter || showCardFilter ? (
          <div className={cn("flex items-center gap-2 px-4 pb-2.5", !ready && "invisible")}>
            {showMonthFilter ? <MonthSwitcher className="flex-1 rounded-2xl border-0 shadow-panel" /> : null}
            {showCardFilter ? <CardSwitcher className="flex-1" mobile /> : null}
          </div>
        ) : null}
      </div>

      {/* Desktop Header (>= lg) */}
      <div className="hidden items-center gap-3 px-8 py-3 lg:flex">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold tracking-tight text-foreground">{item.title}</h1>
          <p className="truncate text-sm text-muted-foreground">{item.subtitle}</p>
        </div>
        <div className={cn("flex items-center gap-2", !ready && "invisible")}>
          <SyncIndicator />
          {showCardFilter ? <CardSwitcher className="flex" /> : null}
          {showMonthFilter ? <MonthSwitcher className="flex" /> : null}
          <Button variant="outline" onClick={() => openCreate()} className="h-9">
            <Plus /> Novo Gasto
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            disabled={isRefreshing}
            onClick={async () => {
              const ok = await reload({ force: true });
              if (ok) toast.success("Dados atualizados");
            }}
            aria-label="Atualizar dados"
            title="Atualizar dados"
          >
            <RefreshCw className={cn("size-4", isRefreshing && "animate-spin text-brand")} />
          </Button>
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={togglePrivacy} aria-label={hidden ? "Mostrar valores" : "Ocultar valores"} title={hidden ? "Mostrar valores" : "Ocultar valores"}>
            {hidden ? <EyeOff className="size-4 text-brand" /> : <Eye className="size-4" />}
          </Button>
          {isLg ? <NotificationCenter /> : null}
          <Button onClick={openImport} className="h-9 bg-brand font-medium text-white hover:bg-brand/90" aria-label="Importar fatura">
            <Upload /> Importar
          </Button>
        </div>
        <span aria-hidden="true" className="h-6 w-px bg-border" />
        <SignOutButton />
      </div>
    </header>
  );
}

function SyncIndicator() {
  const { syncStatus, syncError, retrySync, isRefreshing } = useFinance();
  if (syncStatus === "idle") {
    if (!isRefreshing) return null;
    return (
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border/80 bg-card px-2.5 text-xs text-muted-foreground shadow-panel"
        title="Atualizando dados em segundo plano..."
      >
        <RefreshCw className="size-3.5 animate-spin text-brand" />
        <span className="hidden lg:inline">Atualizando...</span>
      </span>
    );
  }
  if (syncStatus === "saving") {
    return (
      <span
        className="inline-flex h-8 items-center gap-1.5 rounded-xl border border-border/80 bg-card px-2.5 text-xs text-muted-foreground shadow-panel"
        title="Salvando alterações..."
      >
        <Loader2 className="size-3.5 animate-spin text-brand" />
        <span className="hidden lg:inline">Salvando...</span>
      </span>
    );
  }
  return (
    <Button
      size="sm"
      variant="destructive"
      className="h-8 gap-1.5 rounded-xl px-2.5 text-xs"
      onClick={retrySync}
      title={syncError ?? "Erro ao salvar. Clique para tentar novamente."}
    >
      <AlertCircle className="size-3.5" />
      <span className="hidden lg:inline">Erro ao salvar</span>
      <RefreshCw className="size-3" />
    </Button>
  );
}

function CardSwitcher({ className, mobile = false }: { className?: string; mobile?: boolean }) {
  const { state, selectedCardId, setSelectedCardId } = useFinance();
  const visible = state.cards.filter((card) => !card.is_archived || card.id === selectedCardId);
  if (visible.length < 2) return null;
  const options = [
    { value: ALL_CARDS, label: "Todos os cartões" },
    ...visible.map((card) => ({
      value: card.id,
      label: card.parent_card_id ? `↳ ${cardLabel(card)}` : cardLabel(card),
    })),
  ];
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      {!mobile ? <CreditCard className="size-3.5 shrink-0 text-muted-foreground" /> : null}
      <SimpleSelect
        value={selectedCardId ?? ALL_CARDS}
        options={options}
        onChange={(value) => setSelectedCardId(value === ALL_CARDS ? null : value)}
        size="sm"
        className={cn(
          "w-full min-w-32 bg-card shadow-panel lg:w-44",
          mobile ? "h-10 rounded-2xl border-0" : "h-9",
        )}
        ariaLabel="Filtrar por cartão"
      />
    </div>
  );
}

function MonthSwitcher({ className }: { className?: string }) {
  const { selectedMonth, setSelectedMonth, currentMonth } = useFinance();
  const isCurrent = selectedMonth === currentMonth;
  return (
    <div className={cn("flex h-10 items-center justify-between rounded-xl border bg-card px-1 shadow-panel lg:h-9", className)}>
      <Button variant="ghost" size="icon-sm" aria-label="Fatura anterior" onClick={() => setSelectedMonth(addMonths(selectedMonth, -1))}>
        <ChevronLeft />
      </Button>
      <button
        type="button"
        onClick={() => setSelectedMonth(currentMonth)}
        title="Voltar para a fatura atual"
        className="flex items-center gap-1.5 px-1.5 text-xs font-semibold lg:text-sm lg:font-medium"
      >
        <CalendarDays className="size-3.5 text-brand" />
        <span className="num">{formatMonthLabel(selectedMonth)}</span>
        {!isCurrent ? <span className="size-1.5 rounded-full bg-brand" aria-label="não é a fatura atual" /> : null}
      </button>
      <Button variant="ghost" size="icon-sm" aria-label="Próxima fatura" onClick={() => setSelectedMonth(addMonths(selectedMonth, 1))}>
        <ChevronRight />
      </Button>
    </div>
  );
}
