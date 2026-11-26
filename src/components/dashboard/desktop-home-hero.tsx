"use client";

import { ArrowUpDown, CreditCard, Eye, EyeOff, PawPrint, ShieldCheck, Upload } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { QuickAddBar } from "@/components/app/quick-add-bar";
import { formatMonthLabel } from "@/lib/dates";
import { activeCards, closingDayForCard } from "@/lib/domain/operations";
import { cardMonthlySummary, cashFlowSummary, realFreeBalance } from "@/lib/finance/metrics";
import { formatBRL, formatSignedBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

/**
 * Fintech desktop hero row (>= md):
 * pairs the signature gradient Wallet card (with live privacy toggle and
 * interactive credit-card filter pills) alongside 4 pastel quick-action cards
 * and the natural-language QuickAddBar.
 */
export function DesktopHomeHero() {
  const { state, selectedMonth, today, selectedCardId, setSelectedCardId } = useFinance();
  const { openCreate, openImport } = useDialogs();
  const { hidden, toggle: togglePrivacy, mask } = usePrivacy();

  const { hasAccounts, free, flow, closingDay, mainCards } = useMemo(() => {
    const accounts = (state.accounts ?? []).some((a) => !a.is_archived);
    return {
      hasAccounts: accounts,
      free: realFreeBalance(state, selectedMonth, today),
      flow: cashFlowSummary(state, selectedMonth),
      closingDay: closingDayForCard(state, selectedCardId),
      mainCards: activeCards(state).filter((card) => !card.parent_card_id),
    };
  }, [state, selectedMonth, today, selectedCardId]);

  const heroAmount = hasAccounts ? free.freeToSpend : flow.balance;

  return (
    <section className="hidden grid-cols-12 gap-5 md:grid" aria-label="Resumo da carteira">
      {/* Signature Fintech Gradient Wallet Card */}
      <div className="fintech-hero-card relative col-span-12 flex flex-col justify-between overflow-hidden rounded-2xl p-6 text-white xl:col-span-5">
        <span aria-hidden className="pointer-events-none absolute -top-14 -right-10 size-48 rounded-full bg-white/12" />
        <span aria-hidden className="pointer-events-none absolute -right-16 -bottom-20 size-52 rounded-full bg-white/8" />

        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 text-xs font-medium text-white/95">
              <ShieldCheck className="size-3.5 shrink-0" />
              {hasAccounts ? "Saldo Livre Real" : `Saldo • ${formatMonthLabel(selectedMonth)}`}
            </p>
            <p className="num pt-1 text-3xl leading-tight font-bold tracking-tight">
              {mask(formatSignedBRL(heroAmount))}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <button
              type="button"
              onClick={togglePrivacy}
              aria-label={hidden ? "Mostrar valores" : "Ocultar valores"}
              title={hidden ? "Mostrar valores" : "Ocultar valores"}
              className="flex size-8 items-center justify-center rounded-xl bg-white/15 text-white backdrop-blur-xs transition-colors hover:bg-white/25"
            >
              {hidden ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            </button>
            <span className="rounded-xl bg-white/15 px-2.5 py-1 text-[11px] font-bold tracking-wider backdrop-blur-xs">
              {heroAmount >= 0 ? "EM DIA" : "ATENÇÃO"}
            </span>
          </div>
        </div>

        <div className="relative mt-5 grid grid-cols-2 gap-2.5 text-xs">
          <div className="rounded-xl bg-white/14 px-3 py-2 backdrop-blur-xs">
            <span className="block text-[11px] text-white/90">Entradas no mês</span>
            <span className="num font-bold">{mask(formatBRL(flow.inflow))}</span>
          </div>
          <div className="rounded-xl bg-white/14 px-3 py-2 backdrop-blur-xs">
            <span className="block text-[11px] text-white/90">Saídas no mês</span>
            <span className="num font-bold">{mask(formatBRL(flow.outflow))}</span>
          </div>
        </div>

        <div className="relative mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-white/15 pt-3 text-xs text-white/90">
          {mainCards.length > 0 ? (
            <div className="flex flex-wrap items-center gap-1.5">
              {mainCards.slice(0, 3).map((card) => {
                const s = cardMonthlySummary(state, card, selectedMonth, today);
                const active = selectedCardId === card.id;
                return (
                  <button
                    key={card.id}
                    type="button"
                    onClick={() => setSelectedCardId(active ? null : card.id)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[11px] font-semibold backdrop-blur-xs transition-all",
                      active ? "bg-white text-slate-900 shadow-xs" : "bg-white/15 text-white hover:bg-white/25",
                    )}
                    title={`Filtrar por ${card.name}`}
                  >
                    <span className="size-2 rounded-full" style={{ backgroundColor: card.color }} />
                    <span>{card.name}</span>
                    <span className="num opacity-95">{mask(formatBRL(s.spent))}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <span>Fechamento padrão dia {String(closingDay).padStart(2, "0")}</span>
          )}
          <span className="num text-[11px] font-medium text-white/90">Fecha dia {String(closingDay).padStart(2, "0")}</span>
        </div>
      </div>

      {/* Right Column: 4 Pastel Quick Actions + Integrated QuickAddBar */}
      <div className="col-span-12 flex flex-col justify-between gap-4 xl:col-span-7">
        <div className="grid grid-cols-4 gap-3" aria-label="Ações rápidas">
          <button
            type="button"
            onClick={() => openCreate({ type: "expense", invoice_month: selectedMonth })}
            className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-negative/30 dark:border-white/[0.08]"
          >
            <span className="tile-rose flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
              <ArrowUpDown className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">Lançar</span>
              <span className="block truncate text-[11px] text-muted-foreground">Gasto ou receita</span>
            </span>
          </button>

          <button
            type="button"
            onClick={openImport}
            className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-brand/30 dark:border-white/[0.08]"
          >
            <span className="tile-blue flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
              <Upload className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">Importar</span>
              <span className="block truncate text-[11px] text-muted-foreground">CSV ou OFX</span>
            </span>
          </button>

          <Link
            href="/faturas"
            className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-warning/30 dark:border-white/[0.08]"
          >
            <span className="tile-amber flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
              <CreditCard className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">Faturas</span>
              <span className="block truncate text-[11px] text-muted-foreground">Cartões e parcelas</span>
            </span>
          </Link>

          <Link
            href="/meu-pet"
            className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-positive/30 dark:border-white/[0.08]"
          >
            <span className="tile-emerald flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
              <PawPrint className="size-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-xs font-semibold text-foreground">Meu Pet</span>
              <span className="block truncate text-[11px] text-muted-foreground">Gastos e rotina</span>
            </span>
          </Link>
        </div>

        <QuickAddBar />
      </div>
    </section>
  );
}

