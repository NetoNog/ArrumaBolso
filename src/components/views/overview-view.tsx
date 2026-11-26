"use client";

import { CalendarClock, CreditCard, Gauge, Receipt, ShoppingCart, X } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo } from "react";

import { DeferUntilVisible } from "@/components/common/defer-until-visible";
import { AlertsCard } from "@/components/dashboard/alerts-card";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { DesktopHomeHero } from "@/components/dashboard/desktop-home-hero";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { MobileHomeHero } from "@/components/dashboard/mobile-home-hero";
import { WelcomeCard } from "@/components/dashboard/welcome-card";
import { Button } from "@/components/ui/button";

const ChartFallback = () => <div className="ab-shimmer h-[340px] rounded-2xl border border-border/60 md:rounded-xl" aria-hidden />;
const TableFallback = () => <div className="ab-shimmer h-[320px] rounded-2xl border border-border/60 md:rounded-xl" aria-hidden />;

// Split heavy desktop-only Recharts graphs & 1k-line table out of initial mobile & LCP bundles.
const SpendingChart = dynamic(
  () => import("@/components/dashboard/spending-chart").then((m) => m.SpendingChart),
  { ssr: false, loading: ChartFallback },
);
const CashFlowChart = dynamic(
  () => import("@/components/dashboard/cash-flow-chart").then((m) => m.CashFlowChart),
  { ssr: false, loading: ChartFallback },
);
const TransactionsTable = dynamic(
  () => import("@/components/transactions/transactions-table").then((m) => m.TransactionsTable),
  { ssr: false, loading: TableFallback },
);
import { addMonths, formatMonthLabel } from "@/lib/dates";
import {
  averageTicket,
  committedFor,
  delta,
  expensesOfMonth,
  invoiceTotal,
  totalBudget,
  transactionsOfMonth,
} from "@/lib/finance/metrics";
import { cardLabel } from "@/lib/import/issuers";
import { formatBRL, formatPercent, formatSignedBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";
import { useIsDesktop } from "@/lib/use-media-query";

function direction(value: number): "up" | "down" | "flat" {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

export function OverviewView() {
  const { state, selectedMonth, currentMonth, today, selectedCardId, setSelectedCardId } = useFinance();
  const isDesktop = useIsDesktop();
  const previousMonth = addMonths(selectedMonth, -1);
  const nextMonth = addMonths(selectedMonth, 1);
  const activeCard = selectedCardId ? state.cards.find((card) => card.id === selectedCardId) ?? null : null;

  const metrics = useMemo(() => {
    const total = invoiceTotal(state, selectedMonth, selectedCardId);
    const purchases = expensesOfMonth(state, selectedMonth, selectedCardId).length;
    const totalDelta = delta(total, invoiceTotal(state, previousMonth, selectedCardId));
    const committedNext = committedFor(state, nextMonth, currentMonth, today, selectedCardId).total;
    const committedNow = committedFor(state, selectedMonth, currentMonth, today, selectedCardId).total;
    const committedDelta = delta(committedNext, committedNow);
    const ticket = averageTicket(state, selectedMonth, selectedCardId);
    const ticketDelta = delta(ticket, averageTicket(state, previousMonth, selectedCardId));
    const budget = totalBudget(state.categories);
    const usedRatio = budget > 0 ? total / budget : 0;
    const freeRatio = budget > 0 ? Math.max(0, 1 - usedRatio) : 0;
    const monthTxs = isDesktop ? transactionsOfMonth(state, selectedMonth, selectedCardId) : [];
    return { total, purchases, totalDelta, committedNext, committedDelta, ticket, ticketDelta, budget, usedRatio, freeRatio, monthTxs };
  }, [state, selectedMonth, previousMonth, nextMonth, currentMonth, today, selectedCardId, isDesktop]);

  const { total, purchases, totalDelta, committedNext, committedDelta, ticket, ticketDelta, budget, usedRatio, freeRatio, monthTxs } = metrics;

  return (
    <div className="grid gap-5 md:gap-6">
      {!isDesktop ? <MobileHomeHero /> : <DesktopHomeHero />}
      {state.transactions.length === 0 ? <WelcomeCard /> : null}
      {activeCard ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand/25 bg-brand-soft px-4 py-2.5 text-sm md:rounded-xl">
          <span className="flex items-center gap-2 font-medium">
            <CreditCard className="size-4 text-brand" />
            Filtrando Visão Geral por cartão: <strong>{cardLabel(activeCard)}</strong>
          </span>
          <Button size="sm" variant="ghost" onClick={() => setSelectedCardId(null)}>
            <X /> Ver todos os cartões
          </Button>
        </div>
      ) : null}

      <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Indicadores">
        {isDesktop ? (
          <KpiCard
            icon={Receipt}
            iconClassName="tile-rose"
            value={formatBRL(total)}
            subtitle={`Fatura ${selectedMonth === currentMonth ? "Atual" : formatMonthLabel(selectedMonth)} (${purchases} compras)`}
            trend={{
              direction: direction(totalDelta.value),
              label: formatSignedBRL(totalDelta.value),
              tone: totalDelta.value > 0 ? "bad" : totalDelta.value < 0 ? "good" : "neutral",
            }}
          />
        ) : null}
        <KpiCard
          icon={CalendarClock}
          iconClassName="tile-blue"
          value={formatBRL(committedNext)}
          subtitle={`Comprometido ${formatMonthLabel(nextMonth)}`}
          trend={{
            direction: direction(committedDelta.value),
            label: formatSignedBRL(committedDelta.value),
            tone: committedDelta.value > 0 ? "bad" : committedDelta.value < 0 ? "good" : "neutral",
          }}
        />
        {isDesktop ? (
          <KpiCard
            icon={ShoppingCart}
            iconClassName="tile-amber"
            value={formatBRL(ticket)}
            subtitle="Ticket Médio por Compra"
            trend={{
              direction: direction(ticketDelta.value),
              label: ticketDelta.ratio === null ? "—" : `${ticketDelta.ratio > 0 ? "+" : ""}${formatPercent(ticketDelta.ratio)}`,
              tone: ticketDelta.value > 0 ? "bad" : ticketDelta.value < 0 ? "good" : "neutral",
            }}
          />
        ) : null}
        <KpiCard
          icon={Gauge}
          iconClassName="tile-emerald"
          value={budget > 0 ? formatPercent(freeRatio) : "—"}
          subtitle={budget > 0 ? `Orçamento livre (${formatBRL(budget)})` : "Defina tetos em Orçamento"}
          trend={
            budget === 0
              ? { direction: "flat", label: "Sem teto", tone: "neutral" }
              : usedRatio <= 0.75
                ? { direction: "up", label: "Na meta", tone: "good" }
                : usedRatio <= 1
                  ? { direction: "flat", label: "Atenção", tone: "neutral" }
                  : { direction: "down", label: "Estourou", tone: "bad" }
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {isDesktop ? (
          <div className="lg:col-span-8">
            <SpendingChart />
          </div>
        ) : null}
        <div className="lg:col-span-4">
          <AlertsCard />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6">
        {isDesktop ? (
          <DeferUntilVisible minHeight={360} fallback={<ChartFallback />}>
            <CashFlowChart />
          </DeferUntilVisible>
        ) : null}
        <CategoryBreakdown />
        {isDesktop ? (
          <DeferUntilVisible minHeight={320} fallback={<TableFallback />}>
            <TransactionsTable
              title={`Lançamentos da Fatura ${formatMonthLabel(selectedMonth)}${activeCard ? ` • ${cardLabel(activeCard)}` : ""}`}
              description="Clique no nome para editar ou dividir • categoria editável direto na linha"
              transactions={monthTxs}
            />
          </DeferUntilVisible>
        ) : null}
      </section>
    </div>
  );
}
