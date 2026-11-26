"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, type TooltipContentProps } from "recharts";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { CategoryIcon } from "@/components/common/category-icon";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import { PAYMENT_METHOD_LABEL } from "@/lib/domain/types";
import {
  cashFlowHistory,
  dailyCashFlowSeries,
  netExpenseAmount,
  transactionsOfMonth,
} from "@/lib/finance/metrics";
import { formatBRL, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type PeriodMode = "cycle" | "6m";
type TabMode = "income" | "expense";

interface ActivityPoint {
  label: string;
  value: number;
  caption: string;
}

/**
 * Mobile Statistics screen layout (< md):
 * smooth activity spline card on top (reactive to Entradas / Saídas) + curved
 * royal-blue History drawer with segmented toggle, dynamic total, and white cards.
 */
export function MobileStatisticsSheet() {
  const { state, selectedMonth, today, selectedCardId } = useFinance();
  const { openEdit } = useDialogs();
  const { mask } = usePrivacy();
  const [period, setPeriod] = useState<PeriodMode>("cycle");
  const [tab, setTab] = useState<TabMode>("expense");

  const categoriesById = new Map(state.categories.map((c) => [c.id, c]));
  const strokeColor = tab === "income" ? "var(--positive)" : "var(--brand)";

  const series = useMemo<ActivityPoint[]>(() => {
    if (period === "6m") {
      return cashFlowHistory(state, selectedMonth, 6).map((m) => ({
        label: m.label.slice(0, 3),
        value: tab === "income" ? m.inflow : m.outflow,
        caption: m.label,
      }));
    }
    const daily = dailyCashFlowSeries(state, selectedMonth, today);
    const activeDays = daily.filter((d) => d.balance !== null);
    const slice = activeDays.length > 7 ? activeDays.slice(-7) : daily.slice(0, 7);
    return slice.map((d) => ({
      label: d.date.slice(8, 10),
      value: tab === "income" ? d.inflow : d.outflow,
      caption: formatDateBR(d.date),
    }));
  }, [period, state, selectedMonth, today, tab]);

  const allTabTxs = useMemo(
    () =>
      transactionsOfMonth(state, selectedMonth, selectedCardId)
        .filter((tx) => !tx.is_ignored && tx.type === tab)
        .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at)),
    [state, selectedMonth, selectedCardId, tab],
  );

  const history = allTabTxs.slice(0, 6);
  const tabTotal = sumMoney(
    allTabTxs.map((tx) => (tx.type === "income" ? tx.amount : netExpenseAmount(state, tx))),
  );

  return (
    <div className="grid gap-4 md:hidden">
      {/* Top Activity Spline Card */}
      <section className="grid gap-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold tracking-tight text-foreground">
              {tab === "income" ? "Ritmo de entradas" : "Minha atividade"}
            </h2>
            <p className="text-xs text-muted-foreground">{formatMonthLabel(selectedMonth)}</p>
          </div>
          <div className="inline-flex rounded-xl bg-card p-1 shadow-panel">
            {(
              [
                { key: "cycle", label: "Diário" },
                { key: "6m", label: "6 meses" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setPeriod(opt.key)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  period === opt.key ? "bg-brand text-white" : "text-muted-foreground",
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="fintech-mobile-card h-44 border border-border/50 px-2 pt-4 pb-2">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={series} margin={{ top: 8, right: 12, left: 12, bottom: 0 }}>
              <XAxis
                dataKey="label"
                axisLine={false}
                tickLine={false}
                tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              />
              <Tooltip
                content={ActivityTooltip}
                cursor={{ stroke: strokeColor, strokeDasharray: "4 4", strokeOpacity: 0.45 }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke={strokeColor}
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 5, fill: "#FFFFFF", stroke: strokeColor, strokeWidth: 3 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Curved Accent-Aware History Drawer */}
      <section className="fintech-hero-card -mx-4 rounded-t-[32px] px-4 pt-3 pb-6 text-white">
        <span aria-hidden className="mx-auto mb-4 block h-1 w-10 rounded-full bg-white/40" />

        {/* Segmented Entradas / Saídas toggle */}
        <div className="mx-auto mb-4 grid max-w-[260px] grid-cols-2 gap-1.5 rounded-2xl bg-white/15 p-1 backdrop-blur-xs">
          <button
            type="button"
            onClick={() => setTab("income")}
            className={cn(
              "rounded-xl py-2 text-xs font-semibold transition-all",
              tab === "income" ? "bg-white text-slate-900 shadow-sm" : "text-white/90",
            )}
          >
            Entradas
          </button>
          <button
            type="button"
            onClick={() => setTab("expense")}
            className={cn(
              "rounded-xl py-2 text-xs font-semibold transition-all",
              tab === "expense" ? "bg-white text-slate-900 shadow-sm" : "text-white/90",
            )}
          >
            Saídas
          </button>
        </div>

        {/* Dynamic total summary of the selected tab */}
        <div className="mb-3.5 flex items-end justify-between gap-2 px-1">
          <div>
            <p className="text-[11px] font-medium text-white/75">
              {tab === "income" ? "Total de entradas" : "Total de saídas"} ({allTabTxs.length})
            </p>
            <p className="num text-xl font-bold tracking-tight">
              {mask(`${tab === "income" ? "+" : "-"}${formatBRL(Math.abs(tabTotal))}`)}
            </p>
          </div>
          <Link
            href="/lancamentos"
            aria-label="Ver histórico completo"
            className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-white/25"
          >
            Ver tudo <ArrowRight className="size-3.5" />
          </Link>
        </div>

        {history.length === 0 ? (
          <div className="rounded-2xl bg-white/15 px-4 py-6 text-center text-xs text-white/90">
            Nenhum lançamento de {tab === "income" ? "entradas" : "saídas"} em {formatMonthLabel(selectedMonth)}.
          </div>
        ) : (
          <ul className="grid gap-2.5">
            {history.map((tx) => {
              const cat = tx.category_id ? categoriesById.get(tx.category_id) : undefined;
              const isIncome = tx.type === "income";
              const amount = isIncome ? tx.amount : netExpenseAmount(state, tx);
              return (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(tx.id)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-card px-3.5 py-3 text-left text-card-foreground shadow-md shadow-slate-950/12 transition-transform active:scale-[0.99] dark:border dark:border-white/10"
                  >
                    <CategoryIcon
                      icon={cat?.icon ?? (isIncome ? "trending-up" : "tag")}
                      color={cat?.color ?? (isIncome ? "#10B981" : "#4070F4")}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-xl"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold">{tx.clean_title}</p>
                      <p className="num text-xs text-muted-foreground">{formatDateBR(tx.date)}</p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={cn("num text-sm font-bold", isIncome ? "text-positive" : "text-foreground")}>
                        {mask(`${isIncome ? "+" : "-"}${formatBRL(Math.abs(amount))}`)}
                      </p>
                      <p className="max-w-[92px] truncate text-[11px] text-muted-foreground">
                        {cat?.name ?? PAYMENT_METHOD_LABEL[tx.payment_method]}
                      </p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

function ActivityTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as ActivityPoint | undefined;
  if (!active || !point) return null;
  return (
    <div className="rounded-xl border border-border/80 bg-popover/95 px-3 py-1.5 text-center text-popover-foreground shadow-lg backdrop-blur-md">
      <p className="num text-xs font-bold">{formatBRL(point.value)}</p>
      <p className="text-[10px] text-muted-foreground">{point.caption}</p>
    </div>
  );
}
