"use client";

import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  Landmark,
  Pencil,
  PiggyBank,
  Plus,
  Scale,
  ShieldCheck,
  Trash2,
  TrendingUp,
  Utensils,
  type LucideIcon,
} from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
import { CATEGORY_COLORS } from "@/components/common/category-icon";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
import { KpiCard } from "@/components/dashboard/kpi-card";
import { Button } from "@/components/ui/button";

const ChartFallback = () => <div className="ab-shimmer h-[300px] rounded-2xl border border-border/60 md:rounded-xl" aria-hidden />;
const TableFallback = () => <div className="ab-shimmer h-[260px] rounded-2xl border border-border/60 md:rounded-xl" aria-hidden />;

const CashFlowChart = dynamic(
  () => import("@/components/dashboard/cash-flow-chart").then((m) => m.CashFlowChart),
  { ssr: false, loading: ChartFallback },
);
const MobileStatisticsSheet = dynamic(
  () => import("@/components/dashboard/mobile-statistics-sheet").then((m) => m.MobileStatisticsSheet),
  { ssr: false, loading: ChartFallback },
);
const TransactionsTable = dynamic(
  () => import("@/components/transactions/transactions-table").then((m) => m.TransactionsTable),
  { ssr: false, loading: TableFallback },
);
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { addMonths, formatMonthLabel, normalizeDate } from "@/lib/dates";
import { deleteAccount, transferBetweenAccounts, upsertAccount } from "@/lib/domain/operations";
import { ACCOUNT_KIND_LABEL, type Account, type AccountKind, type IsoDate } from "@/lib/domain/types";
import {
  accountBalances,
  cashFlowSummary,
  delta,
  realFreeBalance,
  transactionsOfMonth,
} from "@/lib/finance/metrics";
import { formatBRL, formatPercent, formatSignedBRL, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";
import { useIsDesktop } from "@/lib/use-media-query";

type MobileFlowTab = "overview" | "accounts" | "details";

const ACCOUNT_KIND_ICON: Record<AccountKind, LucideIcon> = {
  checking: Landmark,
  cash: Banknote,
  savings: PiggyBank,
  voucher: Utensils,
  investment: TrendingUp,
};

function direction(value: number): "up" | "down" | "flat" {
  return value > 0 ? "up" : value < 0 ? "down" : "flat";
}

function parseSignedAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return 0;
  const negative = trimmed.startsWith("-");
  const unsigned = trimmed.replace(/^[-+]\s*/, "");
  const parsed = parseAmount(unsigned);
  if (parsed === null) return null;
  return negative ? -parsed : parsed;
}

const ACCOUNT_KIND_OPTIONS: { value: AccountKind; label: string }[] = (
  Object.keys(ACCOUNT_KIND_LABEL) as AccountKind[]
).map((value) => ({ value, label: ACCOUNT_KIND_LABEL[value] }));

type EditingAccount = { open: false } | { open: true; account: Account | null };

export function CashFlowView() {
  const { state, commit, selectedMonth, today } = useFinance();
  const { openCreate } = useDialogs();
  const { mask } = usePrivacy();
  const isDesktop = useIsDesktop();
  const [mobileTab, setMobileTab] = useState<MobileFlowTab>("overview");
  const [editingAccount, setEditingAccount] = useState<EditingAccount>({ open: false });
  const [transferState, setTransferState] = useState<{ open: boolean; defaultFromId?: string }>({ open: false });

  const { summary, inflowDelta, outflowDelta, balanceDelta, movements, balances, activeAccounts, free } = useMemo(() => {
    const cur = cashFlowSummary(state, selectedMonth);
    const prev = cashFlowSummary(state, addMonths(selectedMonth, -1));
    const allBalances = accountBalances(state);
    return {
      summary: cur,
      inflowDelta: delta(cur.inflow, prev.inflow),
      outflowDelta: delta(cur.outflow, prev.outflow),
      balanceDelta: delta(cur.balance, prev.balance),
      movements: transactionsOfMonth(state, selectedMonth).filter((tx) => tx.type !== "payment"),
      balances: allBalances,
      activeAccounts: allBalances.filter((row) => !row.account.is_archived),
      free: realFreeBalance(state, selectedMonth, today),
    };
  }, [state, selectedMonth, today]);

  // Commitment ratio for the mobile Hero Saldo Livre Real bar
  const commitBase = Math.max(free.liquidBalance, free.openCardInvoices + free.pendingFixedBills, 1);
  const cardShare = Math.min(100, (free.openCardInvoices / commitBase) * 100);
  const fixedShare = Math.min(100 - cardShare, (free.pendingFixedBills / commitBase) * 100);
  const freeShare = Math.max(0, 100 - cardShare - fixedShare);

  // Entradas vs Saídas thermometer proportions
  const thermoMax = Math.max(summary.inflow, summary.outflow, 1);
  const inflowBarPct = summary.inflow > 0 ? Math.max((summary.inflow / thermoMax) * 100, 6) : 0;
  const outflowBarPct = summary.outflow > 0 ? Math.max((summary.outflow / thermoMax) * 100, 6) : 0;

  const showTab = (tab: MobileFlowTab) => isDesktop || mobileTab === tab;

  function openTransfer(defaultFromId?: string) {
    if (activeAccounts.length < 2) {
      toast("Cadastre ao menos 2 contas para transferir", {
        description: "Crie sua conta corrente e reserva ou carteira na aba Contas.",
      });
      setMobileTab("accounts");
      setEditingAccount({ open: true, account: null });
      return;
    }
    setTransferState({ open: true, defaultFromId });
  }

  // Dynamic semantic hero style for Saldo Livre Real
  const flowHealth =
    free.freeToSpend < 0
      ? { heroClass: "fintech-hero-negative", badge: "ATENÇÃO" }
      : free.liquidBalance > 0 && free.freeToSpend < free.liquidBalance * 0.12
        ? { heroClass: "fintech-hero-warning", badge: "APERTADO" }
        : { heroClass: "fintech-hero-card", badge: "LIVRE" };

  return (
    <div className="grid gap-5 md:gap-6">
      {/* Mobile Segmented Tabs (Visão | Contas | Detalhes) */}
      <div
        role="tablist"
        aria-label="Seções do fluxo"
        className="grid grid-cols-3 gap-1 rounded-2xl border border-border/60 bg-card p-1 shadow-panel md:hidden"
      >
        {(
          [
            { key: "overview", label: "Visão" },
            { key: "accounts", label: `Contas (${activeAccounts.length})` },
            { key: "details", label: "Detalhes" },
          ] as const
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            aria-selected={mobileTab === t.key}
            onClick={() => setMobileTab(t.key)}
            className={cn(
              "rounded-xl py-2 text-xs font-semibold transition-all",
              mobileTab === t.key ? "bg-brand text-white shadow-xs" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Desktop Pastel Fintech Action Bar (>= md) */}
      <div className="hidden grid-cols-4 gap-3 md:grid" aria-label="Ações de fluxo">
        <button
          type="button"
          onClick={() => openCreate({ type: "income", invoice_month: selectedMonth })}
          className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-positive/35 dark:border-white/[0.08]"
        >
          <span className="tile-emerald flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
            <ArrowDownLeft className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">Nova entrada</span>
            <span className="block truncate text-xs text-muted-foreground">Salário, Pix, extra</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => openCreate({ type: "expense", invoice_month: selectedMonth })}
          className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-negative/35 dark:border-white/[0.08]"
        >
          <span className="tile-rose flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
            <ArrowUpRight className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">Nova saída</span>
            <span className="block truncate text-xs text-muted-foreground">Débito, Pix, boleto</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => openTransfer()}
          className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-brand/35 dark:border-white/[0.08]"
        >
          <span className="tile-blue flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
            <ArrowLeftRight className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">Transferir</span>
            <span className="block truncate text-xs text-muted-foreground">Entre suas contas</span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => setEditingAccount({ open: true, account: null })}
          className="group flex items-center gap-3 rounded-2xl border border-border/80 bg-card p-3 text-left shadow-panel transition-all hover:-translate-y-0.5 hover:border-violet-400/40 dark:border-white/[0.08]"
        >
          <span className="tile-violet flex size-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105">
            <Landmark className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-foreground">Nova conta</span>
            <span className="block truncate text-xs text-muted-foreground">Banco, carteira, VR</span>
          </span>
        </button>
      </div>

      {/* TAB: VISÃO — Unified Semantic Hero Saldo Livre Real + 4 Mobile Pastel Actions + Thermometer + Blue Drawer */}
      {showTab("overview") ? (
        <div className="grid gap-5 motion-safe:animate-[ab-page-enter_150ms_var(--ease-out-strong)] md:gap-6">
        <div className="grid gap-5 lg:grid-cols-12">
          {/* Unified Fintech Hero Card: Saldo Livre Real (mobile & desktop) */}
          <section
            aria-label="Saldo Livre Real"
            className={cn(
              "relative overflow-hidden rounded-[26px] p-5 text-white md:rounded-2xl md:p-6 lg:col-span-7",
              flowHealth.heroClass,
            )}
          >
            <span aria-hidden className="pointer-events-none absolute -top-12 -right-8 size-44 rounded-full bg-white/14" />
            <span aria-hidden className="pointer-events-none absolute -right-14 -bottom-16 size-48 rounded-full bg-white/8" />

            <div className="relative flex items-start justify-between gap-2">
              <div>
                <p className="flex items-center gap-1.5 text-xs font-medium text-white/85">
                  <ShieldCheck className="size-3.5" />
                  Saldo Livre Real • {formatMonthLabel(selectedMonth)}
                </p>
                <p className="num pt-1 text-[30px] leading-tight font-bold tracking-tight md:text-3xl">
                  {mask(formatSignedBRL(free.freeToSpend))}
                </p>
                <p className="hidden pt-1 text-xs text-white/80 md:block">
                  {balances.length > 0
                    ? "Quanto realmente sobra após abater faturas em aberto e contas fixas pendentes do ciclo."
                    : "Cadastre sua conta corrente, dinheiro ou VR/VA para acompanhar quanto está realmente livre."}
                </p>
              </div>
              <span className="rounded-lg bg-white/15 px-2.5 py-1 text-[10.5px] font-bold tracking-wider backdrop-blur-xs">
                {flowHealth.badge}
              </span>
            </div>

            {/* Commitment composition bar */}
            <div className="relative mt-4 grid gap-2">
              <div className="flex h-2 overflow-hidden rounded-full bg-white/20">
                {cardShare > 0 ? <div className="bg-rose-300" style={{ width: `${cardShare}%` }} /> : null}
                {fixedShare > 0 ? <div className="bg-amber-300" style={{ width: `${fixedShare}%` }} /> : null}
                {freeShare > 0 ? <div className="bg-emerald-300" style={{ width: `${freeShare}%` }} /> : null}
              </div>
              <div className="grid grid-cols-2 gap-2 pt-1 text-[11px] sm:grid-cols-4 md:text-xs">
                <div className="rounded-xl bg-white/14 px-2.5 py-1.5 backdrop-blur-xs md:px-3 md:py-2">
                  <span className="block text-white/75">Caixa líquido</span>
                  <span className="num font-bold">{mask(formatBRL(free.liquidBalance))}</span>
                </div>
                <div className="rounded-xl bg-white/14 px-2.5 py-1.5 backdrop-blur-xs md:px-3 md:py-2">
                  <span className="block text-white/75">Reservas / Inv.</span>
                  <span className="num font-bold">{mask(formatBRL(free.savingsBalance))}</span>
                </div>
                <div className="rounded-xl bg-white/14 px-2.5 py-1.5 backdrop-blur-xs md:px-3 md:py-2">
                  <span className="block text-white/75">Faturas abertas</span>
                  <span className="num font-bold text-rose-100">−{mask(formatBRL(free.openCardInvoices))}</span>
                </div>
                <div className="rounded-xl bg-white/14 px-2.5 py-1.5 backdrop-blur-xs md:px-3 md:py-2">
                  <span className="block text-white/75">Fixas pendentes</span>
                  <span className="num font-bold text-amber-100">−{mask(formatBRL(free.pendingFixedBills))}</span>
                </div>
              </div>
            </div>
          </section>

          {/* Desktop Entradas vs Saídas Thermometer Card (paired right beside Saldo Livre Real) */}
          <section
            aria-label="Balanço do mês"
            className="hidden flex-col justify-between gap-4 rounded-2xl border border-border/85 bg-card p-6 shadow-panel dark:border-white/[0.08] md:flex lg:col-span-5"
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-xs font-medium text-muted-foreground">Balanço de {formatMonthLabel(selectedMonth)}</p>
                <p className={cn("num pt-1 text-2xl font-bold tracking-tight", summary.balance < 0 ? "text-negative" : "text-positive")}>
                  {mask(formatSignedBRL(summary.balance))}
                </p>
              </div>
              <Pill
                tone={
                  summary.savingsRate === null
                    ? "slate"
                    : summary.savingsRate >= 0.2
                      ? "emerald"
                      : summary.savingsRate >= 0
                        ? "amber"
                        : "rose"
                }
              >
                {summary.savingsRate === null ? "Sem entradas" : `${formatPercent(summary.savingsRate)} poupado`}
              </Pill>
            </div>

            <div className="grid gap-3.5">
              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-positive">Entradas</span>
                  <span className="num text-sm font-bold text-foreground">{mask(formatBRL(summary.inflow))}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-positive transition-all" style={{ width: `${inflowBarPct}%` }} />
                </div>
              </div>

              <div className="grid gap-1.5">
                <div className="flex items-baseline justify-between text-xs">
                  <span className="font-semibold text-negative">Saídas</span>
                  <span className="num text-sm font-bold text-foreground">{mask(formatBRL(summary.outflow))}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-negative transition-all" style={{ width: `${outflowBarPct}%` }} />
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* 4 Pastel Squircle Action Buttons (mobile only — matches Home style!) */}
        <section className="grid grid-cols-4 gap-3 md:hidden" aria-label="Ações de fluxo">
          <button
            type="button"
            onClick={() => openCreate({ type: "income", invoice_month: selectedMonth })}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span className="tile-emerald flex size-14 items-center justify-center rounded-[18px] shadow-xs">
              <ArrowDownLeft className="size-5" />
            </span>
            <span className="text-[11.5px] font-medium text-foreground/85">Entrada</span>
          </button>

          <button
            type="button"
            onClick={() => openCreate({ type: "expense", invoice_month: selectedMonth })}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span className="tile-rose flex size-14 items-center justify-center rounded-[18px] shadow-xs">
              <ArrowUpRight className="size-5" />
            </span>
            <span className="text-[11.5px] font-medium text-foreground/85">Saída</span>
          </button>

          <button
            type="button"
            onClick={() => openTransfer()}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span className="tile-blue flex size-14 items-center justify-center rounded-[18px] shadow-xs">
              <ArrowLeftRight className="size-5" />
            </span>
            <span className="text-[11.5px] font-medium text-foreground/85">Transferir</span>
          </button>

          <button
            type="button"
            onClick={() => setEditingAccount({ open: true, account: null })}
            className="flex flex-col items-center gap-1.5 transition-transform active:scale-95"
          >
            <span className="tile-violet flex size-14 items-center justify-center rounded-[18px] shadow-xs">
              <Landmark className="size-5" />
            </span>
            <span className="text-[11.5px] font-medium text-foreground/85">Nova conta</span>
          </button>
        </section>

        {/* Visual Thermometer: Entradas vs Saídas (mobile) */}
        <section className="fintech-mobile-card grid gap-3 border border-border/60 p-4 md:hidden" aria-label="Balanço do mês">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs font-medium text-muted-foreground">Balanço de {formatMonthLabel(selectedMonth)}</p>
              <p className={cn("num text-lg font-bold", summary.balance < 0 ? "text-rose-600" : "text-emerald-600")}>
                {mask(formatSignedBRL(summary.balance))}
              </p>
            </div>
            <Pill
              tone={
                summary.savingsRate === null
                  ? "slate"
                  : summary.savingsRate >= 0.2
                    ? "emerald"
                    : summary.savingsRate >= 0
                      ? "amber"
                      : "rose"
              }
            >
              {summary.savingsRate === null ? "Sem entradas" : `${formatPercent(summary.savingsRate)} poupado`}
            </Pill>
          </div>

          <div className="grid gap-2.5">
            <div className="grid gap-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-emerald-700 dark:text-emerald-400">Entradas</span>
                <span className="num font-bold text-foreground">{mask(formatBRL(summary.inflow))}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${inflowBarPct}%` }} />
              </div>
            </div>

            <div className="grid gap-1">
              <div className="flex items-baseline justify-between text-xs">
                <span className="font-medium text-rose-600 dark:text-rose-400">Saídas</span>
                <span className="num font-bold text-foreground">{mask(formatBRL(summary.outflow))}</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-rose-500 transition-all" style={{ width: `${outflowBarPct}%` }} />
              </div>
            </div>
          </div>
        </section>

        {/* Curved Royal-Blue Activity & History Drawer (mobile only — never mounted on desktop) */}
        {!isDesktop ? <MobileStatisticsSheet /> : null}
        </div>
      ) : null}

      {/* TAB: CONTAS — Contas & Carteiras Mini Bank Cards */}
      {showTab("accounts") ? (
        <div className="grid gap-5 motion-safe:animate-[ab-page-enter_150ms_var(--ease-out-strong)] md:gap-6">
        <Card className="rounded-2xl md:rounded-xl">
          <CardHeader className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-sm font-semibold">
                <Landmark className="size-4 text-brand" /> Contas & Carteiras ({balances.length})
              </CardTitle>
              <CardDescription>
                Acompanhe conta corrente, dinheiro físico, VR/VA, caixinhas e investimentos.
              </CardDescription>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
              {activeAccounts.length >= 2 ? (
                <Button size="sm" variant="outline" className="h-9 rounded-xl sm:h-8 sm:rounded-md" onClick={() => openTransfer()}>
                  <ArrowLeftRight /> Transferir
                </Button>
              ) : null}
              <Button
                size="sm"
                className={cn(
                  "h-9 rounded-xl bg-brand text-white hover:bg-blue-700 sm:h-8 sm:rounded-md",
                  activeAccounts.length < 2 && "col-span-2 sm:col-span-1",
                )}
                onClick={() => setEditingAccount({ open: true, account: null })}
              >
                <Plus /> Nova conta
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {balances.length === 0 ? (
              <div className="rounded-2xl border border-dashed px-6 py-8 text-center text-sm text-muted-foreground">
                Nenhuma conta cadastrada ainda. Crie sua conta principal, carteira em dinheiro ou VR/VA para calcular o Saldo Livre Real.
              </div>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {balances.map(({ account, balance, inflows, outflows }) => {
                  const KindIcon = ACCOUNT_KIND_ICON[account.kind];
                  return (
                    <div
                      key={account.id}
                      style={{ borderLeftColor: account.color }}
                      className={cn(
                        "fintech-mobile-card grid gap-3 border border-l-4 border-border/70 p-4",
                        account.is_archived && "opacity-60",
                      )}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span
                            className="flex size-10 shrink-0 items-center justify-center rounded-2xl"
                            style={{ backgroundColor: `${account.color}1A`, color: account.color }}
                          >
                            <KindIcon className="size-4" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-semibold text-foreground">{account.name}</p>
                            <div className="mt-0.5 flex items-center gap-1.5">
                              <Pill tone="slate">{ACCOUNT_KIND_LABEL[account.kind]}</Pill>
                              {account.is_archived ? <Pill tone="amber">Arquivada</Pill> : null}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Editar ${account.name}`}
                            onClick={() => setEditingAccount({ open: true, account })}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Excluir ${account.name}`}
                            onClick={() => {
                              commit((current) => deleteAccount(current, account.id));
                              toast.success(`Conta “${account.name}” removida`);
                            }}
                          >
                            <Trash2 />
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-baseline justify-between gap-2">
                        <p className={cn("num text-2xl font-bold tracking-tight", balance < 0 ? "text-rose-600" : "text-foreground")}>
                          {mask(formatSignedBRL(balance))}
                        </p>
                        {!account.is_archived && activeAccounts.length >= 2 ? (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 rounded-xl px-2.5 text-[11px]"
                            onClick={() => openTransfer(account.id)}
                          >
                            <ArrowLeftRight className="size-3" /> Transferir
                          </Button>
                        ) : null}
                      </div>

                      <div className="num flex items-center justify-between border-t border-border/50 pt-2 text-[11.5px] text-muted-foreground">
                        <span className="text-emerald-600">↑ {mask(formatBRL(inflows))}</span>
                        <span className="text-rose-600">↓ {mask(formatBRL(outflows))}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
        </div>
      ) : null}

      {/* TAB: DETALHES — Chart + Breakdowns + Full Movimentações Table (KPIs hidden on mobile since Visão already shows them) */}
      {showTab("details") ? (
        <div className="grid gap-5 motion-safe:animate-[ab-page-enter_150ms_var(--ease-out-strong)] md:gap-6">
        <section className="hidden grid-cols-2 gap-3 sm:gap-4 md:grid lg:grid-cols-4" aria-label="Resumo do mês">
          <KpiCard
            icon={ArrowDownLeft}
            iconClassName="tile-emerald"
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
            iconClassName="tile-rose"
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
            iconClassName="tile-blue"
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
            iconClassName="tile-violet"
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

        <section className="grid gap-5 lg:grid-cols-2 lg:gap-6">
          <BreakdownCard
            title="Saídas por forma de pagamento"
            description="Onde o dinheiro saiu neste mês. Pagamentos de fatura e transferências não contam: os gastos já estão aqui."
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
          description="Entradas e saídas do mês. Pagamentos de fatura e transferências ficam em Lançamentos."
          transactions={movements}
          headerAction={
            <Button size="sm" variant="outline" onClick={() => openCreate({ type: "income", invoice_month: selectedMonth })}>
              <Plus /> Entrada
            </Button>
          }
        />
        </div>
      ) : null}

      <Dialog open={editingAccount.open} onOpenChange={(open) => !open && setEditingAccount({ open: false })}>
        <DialogContent className="sm:max-w-md">
          {editingAccount.open ? (
            <AccountForm
              key={editingAccount.account?.id ?? "new"}
              account={editingAccount.account}
              onDone={() => setEditingAccount({ open: false })}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={transferState.open} onOpenChange={(open) => !open && setTransferState({ open: false })}>
        <DialogContent className="sm:max-w-md">
          {transferState.open ? (
            <TransferForm
              key={transferState.defaultFromId ?? "default"}
              accounts={activeAccounts.map((row) => row.account)}
              defaultFromId={transferState.defaultFromId}
              today={today}
              onDone={() => setTransferState({ open: false })}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AccountForm({ account, onDone }: { account: Account | null; onDone: () => void }) {
  const { commit } = useFinance();
  const [name, setName] = useState(account?.name ?? "");
  const [kind, setKind] = useState<AccountKind>(account?.kind ?? "checking");
  const [initialText, setInitialText] = useState(
    account ? account.initial_balance.toFixed(2).replace(".", ",") : "0,00",
  );
  const [color, setColor] = useState(account?.color ?? "#4070F4");
  const [archived, setArchived] = useState(Boolean(account?.is_archived));
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Informe o nome da conta.");
    const parsedInitial = parseSignedAmount(initialText);
    if (parsedInitial === null) return setError("Saldo inicial inválido.");
    commit((current) =>
      upsertAccount(current, {
        id: account?.id,
        name: name.trim(),
        kind,
        initial_balance: parsedInitial,
        color,
        is_archived: archived,
      }),
    );
    toast.success(account ? "Conta atualizada" : "Conta criada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{account ? "Editar conta" : "Nova conta / carteira"}</DialogTitle>
        <DialogDescription>
          O saldo atual é calculado a partir do saldo inicial mais lançamentos e transferências vinculadas.
        </DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="acc-name">Nome</Label>
        <Input id="acc-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Nubank Conta, Carteira, Vale Refeição" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="acc-kind">Tipo</Label>
          <SimpleSelect id="acc-kind" value={kind} options={ACCOUNT_KIND_OPTIONS} onChange={setKind} className="w-full" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="acc-init">Saldo inicial (R$)</Label>
          <Input id="acc-init" inputMode="decimal" className="num" value={initialText} onChange={(e) => setInitialText(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Cor</Label>
        <div className="flex flex-wrap gap-2">
          {CATEGORY_COLORS.slice(0, 12).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setColor(option)}
              className={cn("size-6 rounded-full ring-offset-2 ring-offset-background", color === option && "ring-2 ring-foreground")}
              style={{ backgroundColor: option }}
              aria-label={`Cor ${option}`}
            />
          ))}
        </div>
      </div>
      {account ? (
        <label className="flex items-center gap-2 text-xs text-muted-foreground">
          <input type="checkbox" checked={archived} onChange={(e) => setArchived(e.target.checked)} />
          Arquivar conta (oculta dos seletores mantendo histórico)
        </label>
      ) : null}
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </DialogFooter>
    </form>
  );
}

function TransferForm({
  accounts,
  defaultFromId,
  today,
  onDone,
}: {
  accounts: Account[];
  defaultFromId?: string;
  today: IsoDate;
  onDone: () => void;
}) {
  const { commit } = useFinance();
  const initialFrom = defaultFromId && accounts.some((a) => a.id === defaultFromId) ? defaultFromId : (accounts[0]?.id ?? "");
  const initialTo = accounts.find((a) => a.id !== initialFrom)?.id ?? initialFrom;
  const [fromId, setFromId] = useState(initialFrom);
  const [toId, setToId] = useState(initialTo);
  const [amountText, setAmountText] = useState("");
  const [date, setDate] = useState<IsoDate>(today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  const options = accounts.map((acc) => ({ value: acc.id, label: acc.name }));

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseAmount(amountText);
    const iso = normalizeDate(date);
    if (!fromId || !toId || fromId === toId) return setError("Escolha duas contas diferentes.");
    if (amount === null || amount <= 0) return setError("Informe um valor maior que zero.");
    if (!iso) return setError("Data inválida.");
    commit((current) =>
      transferBetweenAccounts(current, {
        fromAccountId: fromId,
        toAccountId: toId,
        amount,
        date: iso,
        notes,
      }),
    );
    toast.success("Transferência registrada", {
      description: `${formatBRL(amount)} transferido sem inflar receitas nem despesas.`,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Transferir entre contas</DialogTitle>
        <DialogDescription>
          Move saldo entre suas contas próprias (ex.: Conta Corrente → Caixinha/Reserva) sem distorcer seus gastos do mês.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tr-from">Conta de origem</Label>
          <SimpleSelect id="tr-from" value={fromId} options={options} onChange={setFromId} className="w-full" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tr-to">Conta de destino</Label>
          <SimpleSelect id="tr-to" value={toId} options={options} onChange={setToId} className="w-full" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="tr-amount">Valor (R$)</Label>
          <Input id="tr-amount" inputMode="decimal" className="num" value={amountText} onChange={(e) => setAmountText(e.target.value)} placeholder="500,00" autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="tr-date">Data</Label>
          <Input id="tr-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="tr-notes">Observação (opcional)</Label>
        <Input id="tr-notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Ex.: Aporte mensal na reserva" />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Confirmar transferência</Button>
      </DialogFooter>
    </form>
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
  const { mask } = usePrivacy();
  return (
    <Card className="rounded-2xl md:rounded-xl">
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
                  {mask(formatBRL(row.amount))} <span className="text-xs text-muted-foreground">({formatPercent(ratio)})</span>
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
