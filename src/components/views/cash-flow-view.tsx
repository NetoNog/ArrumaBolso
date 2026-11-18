"use client";

import { ArrowDownLeft, ArrowUpRight, PiggyBank, Plus, Scale } from "lucide-react";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { CashFlowChart } from "@/components/dashboard/cash-flow-chart";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { TransactionsTable } from "@/components/transactions/transactions-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { addMonths, formatMonthLabel } from "@/lib/dates";
import { cashFlowSummary, delta, transactionsOfMonth } from "@/lib/finance/metrics";
import { formatBRL, formatPercent, formatSignedBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

function direction(value: number): "up" | "down" | "flat" {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

export function CashFlowView() {
  const { state, selectedMonth } = useFinance();
  const { openCreate } = useDialogs();
  const summary = cashFlowSummary(state, selectedMonth);
  const previous = cashFlowSummary(state, addMonths(selectedMonth, -1));
  const inflowDelta = delta(summary.inflow, previous.inflow);
  const outflowDelta = delta(summary.outflow, previous.outflow);
  const balanceDelta = delta(summary.balance, previous.balance);
  const movements = transactionsOfMonth(state, selectedMonth).filter((tx) => tx.type !== "payment");

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => openCreate({ type: "income", invoice_month: selectedMonth })} className="bg-emerald-600 text-white hover:bg-emerald-700">
          <ArrowDownLeft /> Nova entrada
        </Button>
        <Button variant="outline" onClick={() => openCreate({ type: "expense", invoice_month: selectedMonth })}>
          <ArrowUpRight /> Nova saída
        </Button>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4" aria-label="Resumo do mês">
        <KpiCard
          icon={ArrowDownLeft}
          iconClassName="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10"
          value={formatBRL(summary.inflow)}
          subtitle={`Entradas em ${formatMonthLabel(selectedMonth)}`}
          trend={{
            direction: direction(inflowDelta.value),
            label: formatSignedBRL(inflowDelta.value),
            tone: inflowDelta.value > 0 ? "good" : inflowDelta.value < 0 ? "bad" : "neutral",
          }}
        />
        <KpiCard
          icon={ArrowUpRight}
          iconClassName="bg-rose-50 text-rose-600 dark:bg-rose-500/10"
          value={formatBRL(summary.outflow)}
          subtitle={`Saídas em ${formatMonthLabel(selectedMonth)}`}
          trend={{
            direction: direction(outflowDelta.value),
            label: formatSignedBRL(outflowDelta.value),
            tone: outflowDelta.value > 0 ? "bad" : outflowDelta.value < 0 ? "good" : "neutral",
          }}
        />
        <KpiCard
          icon={Scale}
          iconClassName="bg-blue-50 text-blue-600 dark:bg-blue-500/10"
          value={formatSignedBRL(summary.balance)}
          subtitle="Saldo do mês (entradas − saídas)"
          trend={{
            direction: direction(balanceDelta.value),
            label: formatSignedBRL(balanceDelta.value),
            tone: balanceDelta.value > 0 ? "good" : balanceDelta.value < 0 ? "bad" : "neutral",
          }}
        />
        <KpiCard
          icon={PiggyBank}
          iconClassName="bg-violet-50 text-violet-600 dark:bg-violet-500/10"
          value={summary.savingsRate === null ? "—" : formatPercent(summary.savingsRate)}
          subtitle="Taxa de poupança"
          trend={
            summary.savingsRate === null
              ? { direction: "flat", label: "Sem entradas", tone: "neutral" }
              : summary.savingsRate >= 0.2
                ? { direction: "up", label: "Saudável", tone: "good" }
                : summary.savingsRate >= 0
                  ? { direction: "flat", label: "Apertado", tone: "neutral" }
                  : { direction: "down", label: "No vermelho", tone: "bad" }
          }
        />
      </section>

      <CashFlowChart />

      <section className="grid gap-6 lg:grid-cols-2">
        <BreakdownCard
          title="Saídas por forma de pagamento"
          description="Onde o dinheiro saiu neste mês. Pagamentos de fatura não contam: os gastos do cartão já estão aqui."
          rows={summary.outflowByMethod}
          total={summary.outflow}
          barClassName="bg-rose-500"
          emptyText="Nenhuma saída neste mês."
        />
        <BreakdownCard
          title="Entradas por origem"
          description="Recebimentos agrupados pela fonte de renda cadastrada em Salário & Renda."
          rows={summary.inflowByOrigin}
          total={summary.inflow}
          barClassName="bg-emerald-500"
          emptyText="Nenhuma entrada neste mês."
        />
      </section>

      <TransactionsTable
        title={`Movimentações • ${formatMonthLabel(selectedMonth)}`}
        description="Entradas e saídas do mês. Pagamentos de fatura ficam em Lançamentos."
        transactions={movements}
        headerAction={
          <Button size="sm" variant="outline" onClick={() => openCreate({ type: "income", invoice_month: selectedMonth })}>
            <Plus /> Entrada
          </Button>
        }
      />
    </div>
  );
}

function BreakdownCard({
  title,
  description,
  rows,
  total,
  barClassName,
  emptyText,
}: {
  title: string;
  description: string;
  rows: { label: string; amount: number }[];
  total: number;
  barClassName: string;
  emptyText: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3.5">
        {rows.length === 0 ? <p className="py-4 text-center text-sm text-muted-foreground">{emptyText}</p> : null}
        {rows.map((row) => {
          const ratio = total > 0 ? row.amount / total : 0;
          return (
            <div key={row.label} className="grid gap-1.5">
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className="truncate font-medium">{row.label}</span>
                <span className="num shrink-0">
                  {formatBRL(row.amount)} <span className="text-xs text-muted-foreground">({formatPercent(ratio)})</span>
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-muted">
                <div className={cn("h-full rounded-full", barClassName)} style={{ width: `${Math.max(ratio * 100, 2)}%` }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
