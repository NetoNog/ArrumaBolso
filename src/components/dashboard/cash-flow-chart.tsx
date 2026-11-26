"use client";

import { useMemo, useState } from "react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type TooltipContentProps,
} from "recharts";

import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import {
  cashFlowHistory,
  dailyCashFlowSeries,
  type CashFlowDailyPoint,
  type CashFlowMonthPoint,
} from "@/lib/finance/metrics";
import { formatBRL } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type View = "month" | "history";

const INFLOW_COLOR = "var(--chart-3)";
const OUTFLOW_COLOR = "var(--chart-5)";
const BALANCE_COLOR = "var(--chart-1)";

const compactBRL = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });
const AXIS_TICK = { fontSize: 11, fill: "var(--muted-foreground)" };

/** Inflow vs outflow of the selected month (day by day) and of the last six months. */
export function CashFlowChart() {
  const { state, selectedMonth, today } = useFinance();
  const [view, setView] = useState<View>("month");

  const daily = useMemo(() => dailyCashFlowSeries(state, selectedMonth, today), [state, selectedMonth, today]);
  const history = useMemo(() => cashFlowHistory(state, selectedMonth, 6), [state, selectedMonth]);
  const isEmpty = view === "month" ? daily.every((point) => point.inflow === 0 && point.outflow === 0) : history.every((point) => point.inflow === 0 && point.outflow === 0);

  return (
    <Card className="h-full rounded-2xl md:rounded-xl">
      <CardHeader className="flex flex-col gap-3 sm:grid">
        <div>
          <CardTitle className="text-sm font-semibold">Entradas e Saídas</CardTitle>
          <CardDescription>
            {view === "month"
              ? `Movimentação diária e saldo acumulado em ${formatMonthLabel(selectedMonth)}`
              : `Comparativo dos 6 meses até ${formatMonthLabel(selectedMonth)}`}
          </CardDescription>
        </div>
        <CardAction className="w-full sm:w-auto">
          <Tabs value={view} onValueChange={(value) => setView(value as View)} className="w-full sm:w-auto">
            <TabsList className="grid h-8 w-full grid-cols-2 sm:inline-flex sm:w-auto">
              <TabsTrigger value="month" className="px-2 text-xs">
                No mês
              </TabsTrigger>
              <TabsTrigger value="history" className="px-2 text-xs">
                6 meses
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        <Legend />
        <div className="relative h-[220px] pl-0 sm:h-[300px] sm:pl-1">
          {isEmpty ? (
            <p className="absolute inset-0 z-10 flex items-center justify-center px-6 text-center text-sm text-muted-foreground">
              Nenhuma entrada ou saída neste período. Registre um recebimento ou um gasto para ver o gráfico.
            </p>
          ) : null}
          <ResponsiveContainer width="100%" height="100%" debounce={160}>
            {view === "month" ? <DailyChart data={daily} /> : <HistoryChart data={history} />}
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend() {
  const items = [
    { label: "Entradas", color: INFLOW_COLOR, shape: "rounded-sm" },
    { label: "Saídas", color: OUTFLOW_COLOR, shape: "rounded-sm" },
    { label: "Saldo", color: BALANCE_COLOR, shape: "h-0.5 w-3 rounded-full" },
  ];
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <span className={item.shape.startsWith("h-") ? item.shape : `size-2.5 ${item.shape}`} style={{ backgroundColor: item.color }} />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function DailyChart({ data }: { data: CashFlowDailyPoint[] }) {
  // Outflows are drawn below zero so a day with both reads at a glance.
  const rows = data.map((point) => ({ ...point, outflowNegative: -point.outflow }));
  return (
    <ComposedChart data={rows} margin={{ top: 10, right: 12, left: 0, bottom: 0 }} stackOffset="sign">
      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} interval="preserveStartEnd" minTickGap={24} />
      <YAxis tickLine={false} axisLine={false} width={48} tick={AXIS_TICK} tickFormatter={(value: number) => compactBRL.format(value)} />
      <ReferenceLine y={0} stroke="var(--border)" strokeOpacity={0.7} />
      <Tooltip content={DailyTooltip} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
      <Bar dataKey="inflow" stackId="flow" fill={INFLOW_COLOR} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
      <Bar dataKey="outflowNegative" stackId="flow" fill={OUTFLOW_COLOR} radius={[4, 4, 0, 0]} maxBarSize={14} isAnimationActive={false} />
      <Line type="monotone" dataKey="balance" stroke={BALANCE_COLOR} strokeWidth={2} dot={false} connectNulls={false} activeDot={{ r: 4 }} isAnimationActive={false} />
    </ComposedChart>
  );
}

function HistoryChart({ data }: { data: CashFlowMonthPoint[] }) {
  return (
    <ComposedChart data={data} margin={{ top: 10, right: 12, left: 0, bottom: 0 }}>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeOpacity={0.45} strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={AXIS_TICK} />
      <YAxis tickLine={false} axisLine={false} width={48} tick={AXIS_TICK} tickFormatter={(value: number) => compactBRL.format(value)} />
      <ReferenceLine y={0} stroke="var(--border)" strokeOpacity={0.7} />
      <Tooltip content={HistoryTooltip} cursor={{ fill: "var(--muted)", opacity: 0.45 }} />
      <Bar dataKey="inflow" fill={INFLOW_COLOR} radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      <Bar dataKey="outflow" fill={OUTFLOW_COLOR} radius={[5, 5, 0, 0]} maxBarSize={28} isAnimationActive={false} />
      <Line type="monotone" dataKey="balance" stroke={BALANCE_COLOR} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false} />
    </ComposedChart>
  );
}

function TooltipShell({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-44 rounded-xl border border-border/80 bg-popover/95 px-3 py-2 text-xs shadow-lg backdrop-blur-md">
      <p className="pb-1 font-medium text-foreground">{title}</p>
      {rows.map((row) => (
        <div key={row.label} className="flex items-center justify-between gap-4 py-0.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            {row.color ? <span className="size-2 rounded-full" style={{ backgroundColor: row.color }} /> : null}
            {row.label}
          </span>
          <span className="num font-medium text-foreground">{row.value}</span>
        </div>
      ))}
    </div>
  );
}

function DailyTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as CashFlowDailyPoint | undefined;
  if (!active || !point) return null;
  return (
    <TooltipShell
      title={formatDateBR(point.date)}
      rows={[
        { label: "Entradas", value: formatBRL(point.inflow), color: INFLOW_COLOR },
        { label: "Saídas", value: formatBRL(point.outflow), color: OUTFLOW_COLOR },
        { label: "Saldo acumulado", value: point.balance === null ? "—" : formatBRL(point.balance), color: BALANCE_COLOR },
      ]}
    />
  );
}

function HistoryTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as CashFlowMonthPoint | undefined;
  if (!active || !point) return null;
  return (
    <TooltipShell
      title={point.label}
      rows={[
        { label: "Entradas", value: formatBRL(point.inflow), color: INFLOW_COLOR },
        { label: "Saídas", value: formatBRL(point.outflow), color: OUTFLOW_COLOR },
        { label: "Saldo", value: formatBRL(point.balance), color: BALANCE_COLOR },
      ]}
    />
  );
}
