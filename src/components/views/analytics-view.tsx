"use client";

import {
  ArrowDownLeft,
  ArrowUpRight,
  Bug,
  CalendarDays,
  ChevronRight,
  CreditCard,
  Flame,
  Globe,
  PiggyBank,
  Scale,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
} from "lucide-react";
import { useMemo, useState } from "react";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { CategoryIcon } from "@/components/common/category-icon";
import { Pill } from "@/components/common/pill";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import type { IsoDate } from "@/lib/domain/types";
import {
  annualAnalytics,
  antExpensesAnalysis,
  expensesOfMonth,
  merchantProfile,
  nature503020Breakdown,
  netExpenseAmount,
  spendingByWeekday,
  spendingCalendar,
} from "@/lib/finance/metrics";
import { cardLabel } from "@/lib/import/issuers";
import { formatBRL, formatPercent, formatSignedBRL, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";
import { useIsDesktop } from "@/lib/use-media-query";

type MobileTab = "overview" | "habits" | "merchants" | "history";
type DesktopSection = "all" | "habits" | "merchants" | "history";
type PeriodWindow = 3 | 6 | 12;

const MOBILE_TABS: readonly { key: MobileTab; label: string }[] = [
  { key: "overview", label: "Resumo" },
  { key: "habits", label: "Hábitos" },
  { key: "merchants", label: "Lojas" },
  { key: "history", label: "Evolução" },
];

const DESKTOP_TABS: readonly { key: DesktopSection; label: string }[] = [
  { key: "all", label: "Tudo" },
  { key: "habits", label: "Hábitos" },
  { key: "merchants", label: "Lojas & Categorias" },
  { key: "history", label: "Evolução" },
];

const WEEKDAY_HEADERS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
const HEAT_LEVEL_CLASS: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "bg-emerald-50/70 text-emerald-700 border-emerald-200/70 dark:bg-emerald-500/10 dark:text-emerald-300 dark:border-emerald-500/20",
  1: "bg-blue-100 text-blue-900 border-blue-200 dark:bg-blue-500/20 dark:text-blue-100 dark:border-blue-500/30",
  2: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-500/25 dark:text-amber-100 dark:border-amber-500/40",
  3: "bg-orange-300/80 text-orange-950 border-orange-400 dark:bg-orange-500/45 dark:text-orange-50 dark:border-orange-500/50",
  4: "bg-rose-500 text-white border-rose-600 dark:bg-rose-500/80 dark:border-rose-400",
};

export function AnalyticsView() {
  const { state, selectedMonth, today } = useFinance();
  const { openEdit } = useDialogs();
  const { mask } = usePrivacy();
  const isDesktop = useIsDesktop();

  const [mobileTab, setMobileTab] = useState<MobileTab>("overview");
  const [desktopTab, setDesktopTab] = useState<DesktopSection>("all");
  const [periodMonths, setPeriodMonths] = useState<PeriodWindow>(12);
  const [antThreshold, setAntThreshold] = useState<number>(30);
  const [selectedDay, setSelectedDay] = useState<IsoDate | null>(null);
  const [selectedMerchant, setSelectedMerchant] = useState<string | null>(null);

  const data = useMemo(() => annualAnalytics(state, selectedMonth, periodMonths), [state, selectedMonth, periodMonths]);
  const calendar = useMemo(() => spendingCalendar(state, selectedMonth, today), [state, selectedMonth, today]);
  const ants = useMemo(() => antExpensesAnalysis(state, selectedMonth, antThreshold), [state, selectedMonth, antThreshold]);
  const weekdays = useMemo(
    () => spendingByWeekday(state, selectedMonth, Math.min(periodMonths, 6)),
    [state, selectedMonth, periodMonths],
  );
  const nature = useMemo(() => nature503020Breakdown(state, selectedMonth), [state, selectedMonth]);

  const maxWeekday = useMemo(() => Math.max(...weekdays.map((w) => w.total), 1), [weekdays]);
  const peakWeekday = useMemo(
    () => weekdays.reduce((best, cur) => (cur.total > best.total ? cur : best), weekdays[0]),
    [weekdays],
  );
  const categoriesById = useMemo(() => new Map(state.categories.map((cat) => [cat.id, cat])), [state.categories]);
  const merchantData = useMemo(
    () => (selectedMerchant ? merchantProfile(state, selectedMerchant, selectedMonth) : null),
    [state, selectedMerchant, selectedMonth],
  );
  const maxMerchantMonth = merchantData ? Math.max(...merchantData.monthlySeries.map((m) => m.total), 1) : 1;
  const maxMerchantTotal = useMemo(() => Math.max(...data.topMerchants.map((m) => m.total), 1), [data.topMerchants]);
  const leadingEmptyDays = calendar.days[0]?.weekday ?? 0;

  // Tap-to-inspect transactions for the selected calendar day
  const effectiveSelectedDay = selectedDay && calendar.days.some((d) => d.date === selectedDay) ? selectedDay : null;
  const { selectedDayTxs, selectedDayTotal } = useMemo(() => {
    if (!effectiveSelectedDay) return { selectedDayTxs: [], selectedDayTotal: 0 };
    const txs = expensesOfMonth(state, selectedMonth)
      .filter((tx) => tx.date === effectiveSelectedDay)
      .sort((a, b) => b.amount - a.amount);
    return { selectedDayTxs: txs, selectedDayTotal: sumMoney(txs.map((tx) => netExpenseAmount(state, tx))) };
  }, [state, selectedMonth, effectiveSelectedDay]);

  // Automatic Monthly Highlights ("Descobertas do Mês")
  const topDeviation = useMemo(
    () =>
      data.categoryComparison
        .filter((row) => row.vsAverage3mRatio !== null && row.vsAverage3mRatio > 0.1)
        .sort((a, b) => (b.vsAverage3mRatio ?? 0) - (a.vsAverage3mRatio ?? 0))[0],
    [data.categoryComparison],
  );

  const showTab = (tab: MobileTab) => {
    if (!isDesktop) return mobileTab === tab;
    if (tab === "overview") return true;
    return desktopTab === "all" || desktopTab === tab;
  };

  return (
    <div className="grid gap-5 md:gap-6">
      {/* Top Bar: Mobile + Desktop Segmented Tabs & Period Selector (3m / 6m / 12m) */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div
          role="tablist"
          aria-label="Seções de análises"
          className="grid grid-cols-4 gap-1 rounded-2xl border border-border/60 bg-card p-1 shadow-panel md:hidden"
        >
          {MOBILE_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={mobileTab === t.key}
              onClick={() => setMobileTab(t.key)}
              className={cn(
                "rounded-xl py-2 text-xs font-semibold transition-all",
                mobileTab === t.key
                  ? "bg-brand text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          role="tablist"
          aria-label="Seções de análises (desktop)"
          className="hidden items-center gap-1 rounded-xl border border-border/80 bg-card p-1 shadow-panel md:inline-flex"
        >
          {DESKTOP_TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={desktopTab === t.key}
              onClick={() => setDesktopTab(t.key)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all",
                desktopTab === t.key
                  ? "bg-brand text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-between gap-3 md:justify-end">
          <p className="text-xs font-medium text-muted-foreground">
            Janela: <strong className="text-foreground">{periodMonths} meses</strong>
          </p>
          <div className="inline-flex rounded-xl border border-border/80 bg-card p-0.5 shadow-panel">
            {([3, 6, 12] as const).map((months) => (
              <button
                key={months}
                type="button"
                onClick={() => setPeriodMonths(months)}
                className={cn(
                  "rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors",
                  periodMonths === months
                    ? "bg-brand-soft text-brand"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {months}m
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* TAB: RESUMO — Highlights Carousel + Period KPIs (no duplicate Fluxo drawer) */}
      {showTab("overview") ? (
        <div className="grid gap-5 motion-safe:animate-[ab-page-enter_150ms_var(--ease-out-strong)] md:gap-6">
        {/* Descobertas do Mês (Horizontal Swipeable Insights Carousel on mobile, 4-col grid on desktop) */}
        <section className="grid gap-2.5" aria-label="Descobertas do mês">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
            <Sparkles className="size-3.5 text-brand" /> Descobertas de {formatMonthLabel(selectedMonth)}
          </p>
          <div className="-mx-4 flex snap-x snap-mandatory gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] md:mx-0 md:grid md:grid-cols-4 md:px-0 [&::-webkit-scrollbar]:hidden">
            <div className="fintech-mobile-card w-[74%] shrink-0 snap-center border border-emerald-200/70 p-3.5 md:w-auto dark:border-emerald-500/25">
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">Disciplina diária</p>
              <p className="num pt-1 text-lg font-bold text-foreground">{calendar.zeroSpendDays} dia(s)</p>
              <p className="text-[11.5px] text-muted-foreground">de gasto zero neste ciclo</p>
            </div>

            <div className="fintech-mobile-card w-[74%] shrink-0 snap-center border border-orange-200/70 p-3.5 md:w-auto dark:border-orange-500/25">
              <p className="text-[11px] font-medium text-orange-700 dark:text-orange-400">Dia mais caro</p>
              <p className="pt-1 text-lg font-bold text-foreground">
                {peakWeekday && peakWeekday.total > 0 ? peakWeekday.label : "—"}
              </p>
              <p className="num text-[11.5px] text-muted-foreground">
                {peakWeekday && peakWeekday.total > 0
                  ? `${mask(formatBRL(peakWeekday.total))} (${peakWeekday.count} compras)`
                  : "Sem histórico suficiente"}
              </p>
            </div>

            <div className="fintech-mobile-card w-[74%] shrink-0 snap-center border border-amber-200/70 p-3.5 md:w-auto dark:border-amber-500/25">
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">Gastos formiga (≤ R$ {antThreshold})</p>
              <p className="num pt-1 text-lg font-bold text-foreground">{mask(formatBRL(ants.total))}</p>
              <p className="num text-[11.5px] text-muted-foreground">
                {ants.count}x no mês • ~{mask(formatBRL(ants.annualized))}/ano
              </p>
            </div>

            <div className="fintech-mobile-card w-[74%] shrink-0 snap-center border border-blue-200/70 p-3.5 md:w-auto dark:border-blue-500/25">
              <p className="text-[11px] font-medium text-brand">Maior variação vs. média</p>
              <p className="truncate pt-1 text-lg font-bold text-foreground">
                {topDeviation ? topDeviation.category.name : "Sob controle ✓"}
              </p>
              <p className="num text-[11.5px] text-muted-foreground">
                {topDeviation && topDeviation.vsAverage3mRatio !== null
                  ? `+${formatPercent(topDeviation.vsAverage3mRatio)} vs. média 3m`
                  : "Nenhuma categoria disparou"}
              </p>
            </div>
          </div>
        </section>

        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label={`Resumo de ${periodMonths} meses`}>
          <KpiCard
            icon={ArrowDownLeft}
            iconClassName="tile-emerald"
            value={formatBRL(data.totalInflow)}
            subtitle={`Entradas (${periodMonths}m)`}
            trend={{ direction: "flat", label: `${formatBRL(data.totalInflow / periodMonths)}/mês`, tone: "neutral" }}
          />
          <KpiCard
            icon={ArrowUpRight}
            iconClassName="tile-rose"
            value={formatBRL(data.totalOutflow)}
            subtitle={`Saídas (${periodMonths}m)`}
            trend={{ direction: "flat", label: `${formatBRL(data.totalOutflow / periodMonths)}/mês`, tone: "neutral" }}
          />
          <KpiCard
            icon={Scale}
            iconClassName="tile-blue"
            value={formatSignedBRL(data.totalBalance)}
            subtitle={`Saldo (${periodMonths}m)`}
            trend={{
              direction: data.totalBalance > 0 ? "up" : data.totalBalance < 0 ? "down" : "flat",
              label: data.totalBalance >= 0 ? "Positivo" : "Negativo",
              tone: data.totalBalance > 0 ? "good" : data.totalBalance < 0 ? "bad" : "neutral",
            }}
          />
          <KpiCard
            icon={PiggyBank}
            iconClassName="tile-violet"
            value={data.savingsRate === null ? "—" : formatPercent(data.savingsRate)}
            subtitle={`Poupança (${periodMonths}m)`}
            trend={
              data.savingsRate === null
                ? { direction: "flat", label: "Sem entradas", tone: "neutral" }
                : data.savingsRate >= 0.2
                  ? { direction: "up", label: "Saudável", tone: "good" }
                  : data.savingsRate >= 0
                    ? { direction: "flat", label: "Apertado", tone: "neutral" }
                    : { direction: "down", label: "No vermelho", tone: "bad" }
            }
          />
        </section>
        </div>
      ) : null}

      {/* TAB: HÁBITOS — Interactive Heatmap + Ant Expenses + Weekdays + 50/30/20 */}
      {showTab("habits") ? (
        <div className="grid gap-5 motion-safe:animate-[ab-page-enter_150ms_var(--ease-out-strong)] md:gap-6">
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Card className="rounded-2xl md:rounded-xl">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <CalendarDays className="size-4 text-brand" /> Mapa de Calor • {formatMonthLabel(selectedMonth)}
                </CardTitle>
                <div className="flex flex-wrap gap-1.5">
                  <Pill tone="emerald">{calendar.zeroSpendDays} zero</Pill>
                  {calendar.peakDay ? (
                    <Pill tone="rose">
                      Pico: {mask(formatBRL(calendar.peakDay.spent))} ({formatDateBR(calendar.peakDay.date).slice(0, 5)})
                    </Pill>
                  ) : null}
                </div>
              </div>
              <CardDescription>Toque em qualquer dia para inspecionar os gastos daquela data.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              <div className="grid grid-cols-7 gap-1.5 text-center text-[11px] font-medium text-muted-foreground">
                {WEEKDAY_HEADERS.map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1.5">
                {Array.from({ length: leadingEmptyDays }).map((_, idx) => (
                  <div key={`pad-${idx}`} />
                ))}
                {calendar.days.map((cell) => {
                  const isSelected = effectiveSelectedDay === cell.date;
                  return (
                    <button
                      key={cell.date}
                      type="button"
                      disabled={cell.isFuture}
                      aria-pressed={isSelected}
                      onClick={() => setSelectedDay(isSelected ? null : cell.date)}
                      title={
                        cell.isFuture
                          ? `${formatDateBR(cell.date)} • Dia futuro`
                          : cell.spent === 0
                            ? `${formatDateBR(cell.date)} • Gasto zero`
                            : `${formatDateBR(cell.date)} • ${cell.count} compra(s) • ${formatBRL(cell.spent)}`
                      }
                      className={cn(
                        "flex h-10 flex-col items-center justify-center rounded-xl border text-[11px] transition-transform active:scale-95",
                        cell.isFuture
                          ? "cursor-default border-dashed border-border/70 bg-muted/20 text-muted-foreground/60"
                          : HEAT_LEVEL_CLASS[cell.level],
                        isSelected && "ring-2 ring-brand ring-offset-1 ring-offset-card",
                      )}
                    >
                      <span className="num font-semibold leading-none">{cell.dayNumber}</span>
                      {!cell.isFuture && cell.spent > 0 ? (
                        <span className="num mt-0.5 text-[9px] leading-none opacity-85">
                          {cell.spent >= 1000 ? `${(cell.spent / 1000).toFixed(1)}k` : Math.round(cell.spent)}
                        </span>
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {/* Tap-selected day detail panel (works natively on touch screens!) */}
              {effectiveSelectedDay ? (
                <div className="grid gap-2 rounded-2xl border border-brand/30 bg-brand/5 p-3">
                  <div className="flex items-center justify-between gap-2 text-xs">
                    <span className="font-semibold text-foreground">
                      Dia {formatDateBR(effectiveSelectedDay)} ({selectedDayTxs.length} compra{selectedDayTxs.length === 1 ? "" : "s"})
                    </span>
                    <span className="num font-bold text-brand">{mask(formatBRL(selectedDayTotal))}</span>
                  </div>
                  {selectedDayTxs.length === 0 ? (
                    <p className="text-xs text-emerald-700 dark:text-emerald-400">Dia de gasto zero! Parabéns pela disciplina.</p>
                  ) : (
                    <ul className="grid gap-1.5">
                      {selectedDayTxs.map((tx) => (
                        <li key={tx.id}>
                          <button
                            type="button"
                            onClick={() => openEdit(tx.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-xl bg-card px-2.5 py-2 text-left text-xs shadow-xs"
                          >
                            <span className="truncate font-medium text-foreground">{tx.clean_title}</span>
                            <span className="num shrink-0 font-semibold">{mask(formatBRL(netExpenseAmount(state, tx)))}</span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-[11px] text-muted-foreground">
                <span>{calendar.activeDays} dia(s) com compras no ciclo</span>
                <div className="flex items-center gap-1.5">
                  <span>Zero</span>
                  {([0, 1, 2, 3, 4] as const).map((lvl) => (
                    <span key={lvl} className={cn("size-3 rounded-sm border", HEAT_LEVEL_CLASS[lvl])} />
                  ))}
                  <span>Pico</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Detector de Gastos Formiga */}
          <Card className="rounded-2xl md:rounded-xl">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Bug className="size-4 text-amber-600" /> Gastos Formiga
                </CardTitle>
                <div className="flex items-center gap-1">
                  {[20, 30, 50].map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setAntThreshold(value)}
                      className={cn(
                        "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                        antThreshold === value
                          ? "border-foreground bg-foreground text-background"
                          : "bg-card text-muted-foreground hover:bg-muted",
                      )}
                    >
                      ≤ R$ {value}
                    </button>
                  ))}
                </div>
              </div>
              <CardDescription>
                Pequenas compras de até {formatBRL(antThreshold)} em {formatMonthLabel(selectedMonth)}.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border bg-muted/20 p-2.5">
                  <p className="text-[10.5px] text-muted-foreground">No ciclo</p>
                  <p className="num truncate pt-1 text-sm font-bold sm:text-base">{mask(formatBRL(ants.total))}</p>
                  <p className="text-[10.5px] text-muted-foreground">{ants.count}x</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-2.5">
                  <p className="text-[10.5px] text-muted-foreground">Peso</p>
                  <p className="num pt-1 text-sm font-bold text-amber-600 sm:text-base">{formatPercent(ants.shareOfMonth)}</p>
                  <p className="text-[10.5px] text-muted-foreground">do mês</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-2.5">
                  <p className="text-[10.5px] text-muted-foreground">Em 12m</p>
                  <p className="num truncate pt-1 text-sm font-bold text-rose-600 sm:text-base">{mask(formatBRL(ants.annualized))}</p>
                  <p className="text-[10.5px] text-muted-foreground">projeção</p>
                </div>
              </div>
              {ants.topMerchants.length === 0 ? (
                <p className="py-4 text-center text-sm text-muted-foreground">
                  Nenhuma micro-compra até {formatBRL(antThreshold)} neste mês.
                </p>
              ) : (
                <div className="grid gap-1.5">
                  <p className="text-xs font-medium text-muted-foreground">Principais focos (toque para Raio-X):</p>
                  {ants.topMerchants.map((item) => (
                    <button
                      key={item.merchant}
                      type="button"
                      onClick={() => setSelectedMerchant(item.merchant)}
                      className="flex items-center justify-between rounded-xl border px-3 py-2.5 text-left text-xs transition-colors hover:bg-muted/40 active:scale-[0.99]"
                    >
                      <span className="truncate font-medium">
                        {item.merchant} <span className="text-muted-foreground">({item.count}x)</span>
                      </span>
                      <span className="num flex shrink-0 items-center gap-1 font-semibold">
                        {mask(formatBRL(item.total))}
                        <ChevronRight className="size-3.5 text-muted-foreground" />
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Weekday Breakdown & 50/30/20 */}
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <Card className="rounded-2xl md:rounded-xl">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                  <Flame className="size-4 text-orange-500" /> Gastos por Dia da Semana
                </CardTitle>
                {peakWeekday && peakWeekday.total > 0 ? <Pill tone="amber">Pico: {peakWeekday.label}</Pill> : null}
              </div>
              <CardDescription>Em quais dias da semana seus gastos costumam disparar.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-2.5">
              {weekdays.map((row) => {
                const width = row.total > 0 ? Math.max((row.total / maxWeekday) * 100, 3) : 0;
                const isPeak = peakWeekday && row.weekday === peakWeekday.weekday && row.total > 0;
                return (
                  <div key={row.weekday} className="grid grid-cols-[2.25rem_1fr_6.5rem] items-center gap-2.5 text-xs">
                    <span className={cn("font-semibold", isPeak ? "text-orange-600" : "text-muted-foreground")}>{row.label}</span>
                    <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                      <div
                        className={cn("h-full rounded-full", isPeak ? "bg-orange-500" : "bg-brand/80")}
                        style={{ width: `${width}%` }}
                      />
                    </div>
                    <span className="num text-right font-medium">
                      {mask(formatBRL(row.total))} <span className="text-[10px] text-muted-foreground">({row.count})</span>
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>

          <Card className="rounded-2xl md:rounded-xl">
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Equilíbrio 50 / 30 / 20 • {formatMonthLabel(selectedMonth)}</CardTitle>
              <CardDescription>Compare seu perfil real com a regra Essenciais / Estilo de Vida / Patrimônio.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="flex h-3 overflow-hidden rounded-full bg-muted">
                {nature.total > 0 ? (
                  <>
                    <div className="bg-brand" style={{ width: `${nature.ratios.essential * 100}%` }} />
                    <div className="bg-violet-500" style={{ width: `${nature.ratios.lifestyle * 100}%` }} />
                    <div className="bg-emerald-500" style={{ width: `${nature.ratios.financial * 100}%` }} />
                  </>
                ) : null}
              </div>
              <div className="grid gap-2 text-xs">
                {(
                  [
                    { label: "Essenciais (meta 50%)", value: nature.essential, ratio: nature.ratios.essential, dot: "bg-brand" },
                    { label: "Estilo de Vida (meta 30%)", value: nature.lifestyle, ratio: nature.ratios.lifestyle, dot: "bg-violet-500" },
                    { label: "Patrimônio / Metas (meta 20%)", value: nature.financial, ratio: nature.ratios.financial, dot: "bg-emerald-500" },
                  ] as const
                ).map((item) => (
                  <div key={item.label} className="flex items-center justify-between rounded-xl border bg-muted/20 px-3 py-2.5">
                    <span className="flex items-center gap-2 font-medium">
                      <span className={cn("size-2.5 rounded-full", item.dot)} />
                      {item.label}
                    </span>
                    <span className="num font-semibold">
                      {mask(formatBRL(item.value))}{" "}
                      <span className="font-normal text-muted-foreground">({nature.total > 0 ? formatPercent(item.ratio) : "0%"})</span>
                    </span>
                  </div>
                ))}
                {nature.uncategorized > 0 ? (
                  <p className="text-amber-600">+ {mask(formatBRL(nature.uncategorized))} ainda sem categoria neste mês.</p>
                ) : null}
              </div>
            </CardContent>
          </Card>
        </div>
        </div>
      ) : null}

      {/* TAB: LOJAS & CATEGORIAS — Top Merchants + Category Comparison + Card Comparison + Tags */}
      {showTab("merchants") ? (
        <div className="grid gap-5 motion-safe:animate-[ab-page-enter_150ms_var(--ease-out-strong)] md:gap-6">
        <div className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          {/* Top Merchants: Native cards on mobile, Table on desktop */}
          <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Store className="size-4 text-brand" /> Top Estabelecimentos ({periodMonths}m)
              </CardTitle>
              <CardDescription>Toque em qualquer estabelecimento para abrir o Raio-X de 12 meses.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {data.topMerchants.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">Sem despesas suficientes no período.</p>
              ) : (
                <>
                  {/* Mobile native cards */}
                  <ul className="grid gap-2.5 bg-background/60 p-3 md:hidden">
                    {data.topMerchants.map((row, idx) => {
                      const cat = row.categoryId ? categoriesById.get(row.categoryId) : undefined;
                      const barPct = Math.max((row.total / maxMerchantTotal) * 100, 6);
                      return (
                        <li key={row.merchant}>
                          <button
                            type="button"
                            onClick={() => setSelectedMerchant(row.merchant)}
                            className="fintech-mobile-card grid w-full gap-2 border border-border/60 p-3 text-left transition-transform active:scale-[0.99]"
                          >
                            <div className="flex items-center gap-2.5">
                              <span className="num flex size-6 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-bold text-muted-foreground">
                                {idx + 1}
                              </span>
                              <CategoryIcon
                                icon={cat?.icon ?? "store"}
                                color={cat?.color ?? "#4070F4"}
                                className="inline-flex size-9 shrink-0 items-center justify-center rounded-xl"
                              />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold text-foreground">{row.merchant}</p>
                                <p className="num text-[11px] text-muted-foreground">
                                  {row.count} compra(s) • médio {mask(formatBRL(row.average))}
                                </p>
                              </div>
                              <div className="flex shrink-0 items-center gap-1">
                                <span className="num text-sm font-bold text-foreground">{mask(formatBRL(row.total))}</span>
                                <ChevronRight className="size-4 text-muted-foreground" />
                              </div>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-brand/80" style={{ width: `${barPct}%` }} />
                            </div>
                          </button>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table className="min-w-[420px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Estabelecimento</TableHead>
                          <TableHead className="text-right">Compras</TableHead>
                          <TableHead className="text-right">Ticket médio</TableHead>
                          <TableHead className="pr-4 text-right">Total</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.topMerchants.map((row, idx) => {
                          const cat = row.categoryId ? categoriesById.get(row.categoryId) : undefined;
                          return (
                            <TableRow
                              key={row.merchant}
                              onClick={() => setSelectedMerchant(row.merchant)}
                              className="cursor-pointer transition-colors hover:bg-muted/50"
                            >
                              <TableCell className="pl-4">
                                <div className="flex items-center gap-2">
                                  <span className="num w-5 text-xs text-muted-foreground">{idx + 1}.</span>
                                  {cat ? <CategoryIcon icon={cat.icon} color={cat.color} /> : null}
                                  <span className="truncate font-medium hover:underline">{row.merchant}</span>
                                </div>
                              </TableCell>
                              <TableCell className="num text-right text-xs text-muted-foreground">{row.count}</TableCell>
                              <TableCell className="num text-right text-xs text-muted-foreground">{mask(formatBRL(row.average))}</TableCell>
                              <TableCell className="num pr-4 text-right font-semibold">{mask(formatBRL(row.total))}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Category Comparison vs Historical Average: Native cards on mobile, Table on desktop */}
          <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
            <CardHeader className="border-b py-4">
              <CardTitle className="text-sm font-semibold">
                {formatMonthLabel(selectedMonth)} vs. Média Histórica
              </CardTitle>
              <CardDescription>Compare o ciclo selecionado com a média dos 3 e 6 meses anteriores.</CardDescription>
            </CardHeader>
            <CardContent className="px-0">
              {data.categoryComparison.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-muted-foreground">Sem dados de categorias para comparar.</p>
              ) : (
                <>
                  {/* Mobile native cards */}
                  <ul className="grid gap-2.5 bg-background/60 p-3 md:hidden">
                    {data.categoryComparison.map((row) => {
                      const denom = Math.max(row.currentSpent, row.average3m, 1);
                      return (
                        <li key={row.category.id} className="fintech-mobile-card grid gap-2 border border-border/60 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex min-w-0 items-center gap-2 text-sm font-semibold">
                              <CategoryIcon icon={row.category.icon} color={row.category.color} className="inline-flex size-8 shrink-0 items-center justify-center rounded-xl" />
                              <span className="truncate">{row.category.name}</span>
                            </span>
                            {row.vsAverage3mRatio === null ? (
                              <span className="text-xs text-muted-foreground">Novo</span>
                            ) : (
                              <Pill tone={row.vsAverage3mRatio > 0.15 ? "rose" : row.vsAverage3mRatio < -0.1 ? "emerald" : "slate"}>
                                {row.vsAverage3mRatio > 0 ? "+" : ""}
                                {formatPercent(row.vsAverage3mRatio)}
                              </Pill>
                            )}
                          </div>
                          <div className="grid gap-1">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">Atual</span>
                              <span className="num font-bold text-foreground">{mask(formatBRL(row.currentSpent))}</span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full" style={{ width: `${(row.currentSpent / denom) * 100}%`, backgroundColor: row.category.color }} />
                            </div>
                            <div className="num flex justify-between pt-0.5 text-[11px] text-muted-foreground">
                              <span>Média 3m: {mask(formatBRL(row.average3m))}</span>
                              <span>Média 6m: {mask(formatBRL(row.average6m))}</span>
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>

                  {/* Desktop table */}
                  <div className="hidden overflow-x-auto md:block">
                    <Table className="min-w-[460px]">
                      <TableHeader>
                        <TableRow>
                          <TableHead className="pl-4">Categoria</TableHead>
                          <TableHead className="text-right">{formatMonthLabel(selectedMonth)}</TableHead>
                          <TableHead className="text-right">Média 3m</TableHead>
                          <TableHead className="text-right">Média 6m</TableHead>
                          <TableHead className="pr-4 text-right">Desvio</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {data.categoryComparison.map((row) => (
                          <TableRow key={row.category.id}>
                            <TableCell className="pl-4">
                              <span className="flex items-center gap-2 text-sm font-medium">
                                <CategoryIcon icon={row.category.icon} color={row.category.color} /> {row.category.name}
                              </span>
                            </TableCell>
                            <TableCell className="num text-right font-semibold">{mask(formatBRL(row.currentSpent))}</TableCell>
                            <TableCell className="num text-right text-xs text-muted-foreground">{mask(formatBRL(row.average3m))}</TableCell>
                            <TableCell className="num text-right text-xs text-muted-foreground">{mask(formatBRL(row.average6m))}</TableCell>
                            <TableCell className="pr-4 text-right">
                              {row.vsAverage3mRatio === null ? (
                                <span className="text-xs text-muted-foreground">—</span>
                              ) : (
                                <Pill tone={row.vsAverage3mRatio > 0.15 ? "rose" : row.vsAverage3mRatio < -0.1 ? "emerald" : "slate"}>
                                  {row.vsAverage3mRatio > 0 ? "+" : ""}
                                  {formatPercent(row.vsAverage3mRatio)}
                                </Pill>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Card Comparison */}
        {data.cardComparison.length > 0 ? (
          <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
            <CardHeader className="border-b py-4">
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <CreditCard className="size-4 text-brand" /> Comparativo entre Cartões ({periodMonths}m)
              </CardTitle>
              <CardDescription>Participação nos gastos, estimativa de cashback/pontos e anuidade.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-4">
              {data.cardComparison.map((row) => (
                <div key={row.card.id} className="grid gap-1.5">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="flex items-center gap-2 font-medium">
                      <span className="size-2.5 rounded-full" style={{ backgroundColor: row.card.color }} />
                      {cardLabel(row.card)}
                      {row.card.is_archived ? <Pill tone="slate">Arquivado</Pill> : null}
                    </span>
                    <span className="num font-semibold">
                      {mask(formatBRL(row.total))}{" "}
                      <span className="text-xs font-normal text-muted-foreground">({formatPercent(row.share)})</span>
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full" style={{ width: `${Math.max(row.share * 100, 2)}%`, backgroundColor: row.card.color }} />
                  </div>
                  <div className="num flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
                    <span>{row.count} compras</span>
                    {row.estimatedCashback > 0 ? (
                      <span className="text-emerald-600">Cashback est. {mask(formatBRL(row.estimatedCashback))}</span>
                    ) : null}
                    {row.estimatedPoints > 0 ? (
                      <span className="text-violet-600">~{row.estimatedPoints.toLocaleString("pt-BR")} pts</span>
                    ) : null}
                    {row.annualFee > 0 ? <span>Anuidade {mask(formatBRL(row.annualFee))}/ano</span> : null}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}

        {/* Tags Breakdown */}
        <Card className="rounded-2xl md:rounded-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Tag className="size-4 text-violet-600" /> Gastos por Tag / Projeto ({periodMonths}m)
            </CardTitle>
            <CardDescription>
              Adicione tags como <code>#viagem</code>, <code>#reforma</code> ou <code>#irpf</code> para consolidar projetos.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data.tagBreakdown.length === 0 ? (
              <p className="py-4 text-sm text-muted-foreground">Nenhuma tag usada nos últimos {periodMonths} meses.</p>
            ) : (
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
                {data.tagBreakdown.map((item) => (
                  <div key={item.tag} className="rounded-2xl border bg-muted/20 p-3.5">
                    <span className="inline-block rounded-full bg-muted px-2 py-0.5 text-xs font-medium">#{item.tag}</span>
                    <p className="num pt-2 text-base font-bold sm:text-lg">{mask(formatBRL(item.total))}</p>
                    <p className="text-xs text-muted-foreground">{item.count} lançamento(s)</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      ) : null}

      {/* TAB: EVOLUÇÃO — International / IOF + Monthly Evolution (Native Mobile Cards + Desktop Table) */}
      {showTab("history") ? (
        <div className="grid gap-5 motion-safe:animate-[ab-page-enter_150ms_var(--ease-out-strong)] md:gap-6">
        {data.internationalSummary.count > 0 || data.internationalSummary.totalIOF > 0 ? (
          <Card className="rounded-2xl md:rounded-xl">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Globe className="size-4 text-sky-600" /> Compras Internacionais & IOF ({periodMonths}m)
              </CardTitle>
              <CardDescription>Total gasto em moeda estrangeira e IOF acumulado no período.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid grid-cols-3 gap-2.5">
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">Compras</p>
                  <p className="num pt-1 text-base font-bold">{data.internationalSummary.count}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">Total R$</p>
                  <p className="num truncate pt-1 text-base font-bold">{mask(formatBRL(data.internationalSummary.totalBRL))}</p>
                </div>
                <div className="rounded-xl border p-3">
                  <p className="text-[11px] text-muted-foreground">IOF</p>
                  <p className="num truncate pt-1 text-base font-bold text-rose-600">{mask(formatBRL(data.internationalSummary.totalIOF))}</p>
                </div>
              </div>
              {data.internationalSummary.byCurrency.length > 0 ? (
                <div className="grid gap-1.5 text-xs">
                  {data.internationalSummary.byCurrency.map((item) => (
                    <div key={item.currency} className="flex items-center justify-between rounded-xl border px-3 py-2">
                      <span className="font-medium">
                        {item.currency} ({item.count}x)
                      </span>
                      <span className="num">
                        {item.currency} {item.originalTotal.toFixed(2)} → <strong>{mask(formatBRL(item.brlTotal))}</strong>
                      </span>
                    </div>
                  ))}
                </div>
              ) : null}
            </CardContent>
          </Card>
        ) : null}

        {/* Monthly Seasonality: Native Cards on Mobile, Table on Desktop */}
        <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
          <CardHeader className="border-b py-4">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="size-4 text-brand" /> Evolução mensal ({periodMonths} meses)
            </CardTitle>
            <CardDescription>Sazonalidade de entradas, saídas e saldo líquido mês a mês.</CardDescription>
          </CardHeader>
          <CardContent className="px-0">
            {/* Mobile native cards */}
            <ul className="grid gap-2.5 bg-background/60 p-3 md:hidden">
              {[...data.months].reverse().map((m) => {
                const rate = m.inflow > 0 ? m.balance / m.inflow : null;
                return (
                  <li key={m.month} className="fintech-mobile-card grid gap-2 border border-border/60 p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {m.label}
                        {rate !== null ? (
                          <Pill tone={rate >= 0.2 ? "emerald" : rate >= 0 ? "slate" : "rose"}>
                            {formatPercent(rate)}
                          </Pill>
                        ) : null}
                      </span>
                      <span className={cn("num text-sm font-bold", m.balance < 0 ? "text-rose-600" : "text-emerald-600")}>
                        {mask(formatSignedBRL(m.balance))}
                      </span>
                    </div>
                    <div className="num flex items-center justify-between text-xs text-muted-foreground">
                      <span className="text-emerald-600">Entradas: {mask(formatBRL(m.inflow))}</span>
                      <span>Saídas: {mask(formatBRL(m.outflow))}</span>
                    </div>
                  </li>
                );
              })}
            </ul>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-4">Mês</TableHead>
                    <TableHead className="text-right">Entradas</TableHead>
                    <TableHead className="text-right">Saídas</TableHead>
                    <TableHead className="text-right">Saldo</TableHead>
                    <TableHead className="pr-4 text-right">Poupança</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...data.months].reverse().map((m) => {
                    const rate = m.inflow > 0 ? m.balance / m.inflow : null;
                    return (
                      <TableRow key={m.month}>
                        <TableCell className="pl-4 font-medium">{m.label}</TableCell>
                        <TableCell className="num text-right text-emerald-600">{mask(formatBRL(m.inflow))}</TableCell>
                        <TableCell className="num text-right">{mask(formatBRL(m.outflow))}</TableCell>
                        <TableCell className={cn("num text-right font-semibold", m.balance < 0 ? "text-rose-600" : "text-foreground")}>
                          {mask(formatSignedBRL(m.balance))}
                        </TableCell>
                        <TableCell className="num pr-4 text-right text-xs text-muted-foreground">
                          {rate === null ? "—" : formatPercent(rate)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
        </div>
      ) : null}

      {/* Merchant X-Ray Native Bottom Sheet (mobile) / Modal (desktop) */}
      <Dialog open={merchantData !== null} onOpenChange={(open) => !open && setSelectedMerchant(null)}>
        <DialogContent className="sm:max-w-lg">
          {merchantData ? (
            <div className="grid gap-4">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Store className="size-4 text-brand" /> Raio-X: {merchantData.merchant}
                </DialogTitle>
                <DialogDescription>
                  Histórico dos últimos 12 ciclos até {formatMonthLabel(selectedMonth)} ({merchantData.count} compra(s)).
                </DialogDescription>
              </DialogHeader>

              <div className="grid grid-cols-2 gap-2.5 text-xs">
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Total 12 meses</p>
                  <p className="num pt-1 text-base font-bold">{mask(formatBRL(merchantData.total))}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Ticket médio</p>
                  <p className="num pt-1 text-base font-bold">{mask(formatBRL(merchantData.average))}</p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Menor / Maior</p>
                  <p className="num pt-1 text-xs font-bold sm:text-sm">
                    {mask(formatBRL(merchantData.min))} / {mask(formatBRL(merchantData.max))}
                  </p>
                </div>
                <div className="rounded-xl border bg-muted/20 p-3">
                  <p className="text-muted-foreground">Frequência</p>
                  <p className="num pt-1 text-base font-bold">
                    {merchantData.monthlyAverageFrequency.toFixed(1)}x / mês
                  </p>
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground">Evolução mensal (12m)</p>
                <div className="flex h-28 items-end gap-1.5 rounded-2xl border bg-muted/15 p-3">
                  {merchantData.monthlySeries.map((pt) => {
                    const heightPct = pt.total > 0 ? Math.max((pt.total / maxMerchantMonth) * 100, 8) : 2;
                    return (
                      <div
                        key={pt.month}
                        title={`${pt.label}: ${formatBRL(pt.total)} (${pt.count}x)`}
                        className="flex flex-1 flex-col items-center gap-1"
                      >
                        <div className="flex h-20 w-full items-end">
                          <div
                            className={cn("w-full rounded-t", pt.total > 0 ? "bg-brand" : "bg-muted")}
                            style={{ height: `${heightPct}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-muted-foreground">{pt.label.slice(0, 3)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid gap-2">
                <p className="text-xs font-medium text-muted-foreground">Lançamentos ({merchantData.transactions.length})</p>
                <ul className="max-h-56 divide-y overflow-y-auto rounded-2xl border">
                  {merchantData.transactions.map((tx) => (
                    <li key={tx.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedMerchant(null);
                          openEdit(tx.id);
                        }}
                        className="flex w-full items-center justify-between gap-3 px-3 py-2.5 text-left text-xs hover:bg-muted/40"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium text-foreground">{tx.clean_title}</p>
                          <p className="num text-muted-foreground">
                            {formatDateBR(tx.date)} • {formatMonthLabel(tx.invoice_month)}
                          </p>
                        </div>
                        <span className="num shrink-0 font-semibold">{mask(formatBRL(netExpenseAmount(state, tx)))}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
