"use client";

import { CalendarClock, Gauge, Receipt, ShoppingCart } from "lucide-react";

import { AlertsCard } from "@/components/dashboard/alerts-card";
import { CategoryBreakdown } from "@/components/dashboard/category-breakdown";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { SpendingChart } from "@/components/dashboard/spending-chart";
import { TransactionsTable } from "@/components/transactions/transactions-table";
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
import { formatBRL, formatPercent, formatSignedBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

function direction(value: number): "up" | "down" | "flat" {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

export function OverviewView() {
  const { state, selectedMonth, currentMonth, today } = useFinance();
  const previousMonth = addMonths(selectedMonth, -1);
  const nextMonth = addMonths(selectedMonth, 1);

  const total = invoiceTotal(state, selectedMonth);
  const purchases = expensesOfMonth(state, selectedMonth).length;
  const totalDelta = delta(total, invoiceTotal(state, previousMonth));

  const committedNext = committedFor(state, nextMonth, currentMonth, today).total;
  const committedNow = committedFor(state, selectedMonth, currentMonth, today).total;
  const committedDelta = delta(committedNext, committedNow);

  const ticket = averageTicket(state, selectedMonth);
  const ticketDelta = delta(ticket, averageTicket(state, previousMonth));

  const budget = totalBudget(state.categories);
  const usedRatio = budget > 0 ? total / budget : 0;
  const freeRatio = budget > 0 ? Math.max(0, 1 - usedRatio) : 0;

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Indicadores">
        <KpiCard
          icon={Receipt}
          iconClassName="bg-[#FEF2F2] text-[#EF4444] dark:bg-red-500/10"
          value={formatBRL(total)}
          subtitle={`Fatura ${selectedMonth === currentMonth ? "Atual" : formatMonthLabel(selectedMonth)} (${purchases} compras)`}
          trend={{
            direction: direction(totalDelta.value),
            label: formatSignedBRL(totalDelta.value),
            tone: totalDelta.value > 0 ? "bad" : totalDelta.value < 0 ? "good" : "neutral",
          }}
        />
        <KpiCard
          icon={CalendarClock}
          iconClassName="bg-[#EFF6FF] text-[#2563EB] dark:bg-blue-500/10"
          value={formatBRL(committedNext)}
          subtitle={`Comprometido ${formatMonthLabel(nextMonth)}`}
          trend={{
            direction: direction(committedDelta.value),
            label: formatSignedBRL(committedDelta.value),
            tone: committedDelta.value > 0 ? "bad" : committedDelta.value < 0 ? "good" : "neutral",
          }}
        />
        <KpiCard
          icon={ShoppingCart}
          iconClassName="bg-[#ECFDF5] text-[#10B981] dark:bg-emerald-500/10"
          value={formatBRL(ticket)}
          subtitle="Ticket Médio por Compra"
          trend={{
            direction: direction(ticketDelta.value),
            label: ticketDelta.ratio === null ? "—" : `${ticketDelta.ratio > 0 ? "+" : ""}${formatPercent(ticketDelta.ratio)}`,
            tone: ticketDelta.value > 0 ? "bad" : ticketDelta.value < 0 ? "good" : "neutral",
          }}
        />
        <KpiCard
          icon={Gauge}
          iconClassName="bg-[#F0FDF4] text-[#16A34A] dark:bg-green-500/10"
          value={budget > 0 ? formatPercent(freeRatio) : "—"}
          subtitle={budget > 0 ? `Orçamento Disponível de ${formatBRL(budget)}` : "Defina tetos em Orçamento & Metas"}
          trend={
            budget === 0
              ? { direction: "flat", label: "Sem teto", tone: "neutral" }
              : usedRatio <= 0.75
                ? { direction: "up", label: "Dentro da meta", tone: "good" }
                : usedRatio <= 1
                  ? { direction: "flat", label: "Atenção", tone: "neutral" }
                  : { direction: "down", label: "Acima do teto", tone: "bad" }
          }
        />
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-8">
          <SpendingChart />
        </div>
        <div className="lg:col-span-4">
          <AlertsCard />
        </div>
      </section>

      <section className="grid grid-cols-1 gap-6">
        <CategoryBreakdown />
        <TransactionsTable
          title={`Lançamentos da Fatura ${formatMonthLabel(selectedMonth)}`}
          description="Clique no nome para editar • categoria editável direto na linha"
          transactions={transactionsOfMonth(state, selectedMonth)}
        />
      </section>
    </div>
  );
}
