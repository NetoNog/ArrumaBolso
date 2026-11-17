"use client";

import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  ComposedChart,
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
import { dailyCumulativeSeries, totalBudget, twelveMonthSeries, type DailyPoint, type MonthlyPoint } from "@/lib/finance/metrics";
import { formatBRL, formatPercent } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type View = "daily" | "projection";

const compactBRL = new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 });

function axisMoney(value: number): string {
  return compactBRL.format(value);
}

export function SpendingChart() {
  const { state, selectedMonth, currentMonth, today } = useFinance();
  const [view, setView] = useState<View>("daily");
  const budget = totalBudget(state.categories);

  const daily = useMemo(() => dailyCumulativeSeries(state, selectedMonth, today), [state, selectedMonth, today]);
  const monthly = useMemo(() => twelveMonthSeries(state, currentMonth, today), [state, currentMonth, today]);

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-sm font-semibold">
          {view === "daily" ? "Evolução Acumulada da Fatura" : "Realizado vs. Comprometido Futuro"}
        </CardTitle>
        <CardDescription>
          {view === "daily"
            ? `Gastos acumulados por dia no ciclo ${formatMonthLabel(selectedMonth)}`
            : "Totais realizados por fatura e compromissos já assumidos para os próximos meses"}
        </CardDescription>
        <CardAction>
          <Tabs value={view} onValueChange={(value) => setView(value as View)}>
            <TabsList className="h-8">
              <TabsTrigger value="daily" className="px-2 text-xs">
                Acumulado Diário <span className="hidden xl:inline">(Ciclo)</span>
              </TabsTrigger>
              <TabsTrigger value="projection" className="px-2 text-xs">
                Projeção 12 Meses
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </CardAction>
      </CardHeader>
      <CardContent className="h-[300px] pl-1 sm:h-[320px]">
        <ResponsiveContainer width="100%" height="100%">
          {view === "daily" ? <DailyChart data={daily} budget={budget} /> : <ProjectionChart data={monthly} currentMonth={currentMonth} />}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

function DailyChart({ data, budget }: { data: DailyPoint[]; budget: number }) {
  const max = Math.max(...data.map((point) => point.cumulative ?? 0), 0);
  const showBudget = budget > 0 && budget <= max * 3;
  return (
    <AreaChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="dailyFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.22} />
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} interval="preserveStartEnd" minTickGap={24} />
      <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={axisMoney} domain={[0, showBudget ? Math.max(budget, max) * 1.05 : "auto"]} />
      {showBudget ? (
        <ReferenceLine y={budget} stroke="var(--chart-5)" strokeDasharray="4 4" label={{ value: "Teto", position: "insideTopRight", fontSize: 11, fill: "var(--chart-5)" }} />
      ) : null}
      <Tooltip content={DailyTooltip} cursor={{ stroke: "var(--border)" }} />
      <Area type="monotone" dataKey="cumulative" stroke="var(--chart-1)" strokeWidth={2} fill="url(#dailyFill)" connectNulls={false} activeDot={{ r: 4 }} />
    </AreaChart>
  );
}

function ProjectionChart({ data, currentMonth }: { data: MonthlyPoint[]; currentMonth: string }) {
  const budget = data[0]?.budget ?? 0;
  return (
    <ComposedChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 0 }}>
      <defs>
        <linearGradient id="realizedFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.2} />
          <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.01} />
        </linearGradient>
      </defs>
      <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="3 3" />
      <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} />
      <YAxis tickLine={false} axisLine={false} width={48} tick={{ fontSize: 11, fill: "var(--muted-foreground)" }} tickFormatter={axisMoney} />
      {budget > 0 ? <ReferenceLine y={budget} stroke="var(--chart-5)" strokeDasharray="4 4" /> : null}
      <ReferenceLine x={formatMonthLabel(currentMonth)} stroke="var(--muted-foreground)" strokeOpacity={0.4} />
      <Tooltip content={ProjectionTooltip} cursor={{ fill: "var(--muted)", opacity: 0.4 }} />
      <Area type="monotone" dataKey="realized" name="Realizado" stroke="var(--chart-1)" strokeWidth={2} fill="url(#realizedFill)" connectNulls={false} />
      <Line type="monotone" dataKey="committed" name="Comprometido" stroke="var(--chart-2)" strokeWidth={2} strokeDasharray="5 4" dot={{ r: 3 }} connectNulls={false} />
    </ComposedChart>
  );
}

function TooltipShell({ title, rows }: { title: string; rows: { label: string; value: string; color?: string }[] }) {
  return (
    <div className="min-w-44 rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
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
  const point = payload?.[0]?.payload as DailyPoint | undefined;
  if (!active || !point) return null;
  return (
    <TooltipShell
      title={formatDateBR(point.date)}
      rows={[
        { label: "Gasto do dia", value: formatBRL(point.spent) },
        { label: "Acumulado", value: point.cumulative === null ? "—" : formatBRL(point.cumulative), color: "var(--chart-1)" },
        { label: "% do teto", value: point.ceilingRatio === null ? "—" : formatPercent(point.ceilingRatio) },
      ]}
    />
  );
}

function ProjectionTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as MonthlyPoint | undefined;
  if (!active || !point) return null;
  return (
    <TooltipShell
      title={`Fatura ${point.label}`}
      rows={[
        ...(point.realized !== null ? [{ label: "Realizado", value: formatBRL(point.realized), color: "var(--chart-1)" }] : []),
        ...(point.committed !== null ? [{ label: "Comprometido", value: formatBRL(point.committed), color: "var(--chart-2)" }] : []),
        { label: "Teto", value: formatBRL(point.budget) },
      ]}
    />
  );
}
