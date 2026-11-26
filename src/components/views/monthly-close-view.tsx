"use client";

import {
  AlertTriangle,
  CheckCircle2,
  ClipboardCheck,
  CreditCard,
  PiggyBank,
  Repeat,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { Pill } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { addMonths, formatDateBR, formatMonthLabel } from "@/lib/dates";
import {
  activeCards,
  autoCategorizeUncategorized,
  contributeSavingsGoal,
  payCardInvoice,
  paySubscription,
} from "@/lib/domain/operations";
import {
  antExpensesAnalysis,
  cardMonthlySummary,
  cashFlowSummary,
  categoryBreakdown,
  duplicateCandidates,
  expensesOfMonth,
  nature503020Breakdown,
  netExpenseAmount,
  spendingCalendar,
  subscriptionMonthStatus,
} from "@/lib/finance/metrics";
import { formatBRL, formatPercent, formatSignedBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function MonthlyCloseView() {
  const { state, commit, selectedMonth, today } = useFinance();
  const { openEdit } = useDialogs();
  const [goalInputs, setGoalInputs] = useState<Record<string, string>>({});

  // Step 1: Triage
  const uncategorized = expensesOfMonth(state, selectedMonth).filter((tx) => !tx.category_id);
  const duplicates = duplicateCandidates(state, selectedMonth);
  const step1Done = uncategorized.length === 0 && duplicates.length === 0;

  // Step 2: Invoices & Fixed bills
  const mainCards = activeCards(state).filter((card) => !card.parent_card_id);
  const cardSummaries = mainCards.map((card) => cardMonthlySummary(state, card, selectedMonth, today));
  const openCards = cardSummaries.filter((s) => !s.isPaid && (s.spent > 0 || s.unpaidPastBalance > 0));

  const dueSubs = state.recurring_subscriptions
    .map((sub) => ({ sub, status: subscriptionMonthStatus(state, sub, selectedMonth) }))
    .filter(({ status }) => status.dueInMonth);
  const pendingSubs = dueSubs.filter(({ status }) => !status.paid);
  const step2Done = openCards.length === 0 && pendingSubs.length === 0;

  // Step 3: Monthly Bulletin
  const summary = cashFlowSummary(state, selectedMonth);
  const calendar = spendingCalendar(state, selectedMonth, today);
  const ants = antExpensesAnalysis(state, selectedMonth, 30);
  const nature = nature503020Breakdown(state, selectedMonth);

  const prevMonth = addMonths(selectedMonth, -1);
  const prevByCat = new Map(categoryBreakdown(state, prevMonth).map((row) => [row.category?.id ?? "none", row.spent]));
  const biggestJump = categoryBreakdown(state, selectedMonth)
    .filter((row) => row.category)
    .map((row) => {
      const prev = prevByCat.get(row.category!.id) ?? 0;
      return { name: row.category!.name, current: row.spent, delta: sumMoney([row.spent, -prev]) };
    })
    .filter((item) => item.delta > 0)
    .sort((a, b) => b.delta - a.delta)[0];

  // Step 4: Savings Goals allocation
  const goals = state.savings_goals ?? [];
  const surplus = Math.max(0, summary.balance);

  const completedCount = [step1Done, step2Done, true, surplus === 0 || goals.length > 0].filter(Boolean).length;

  function runAutoCategorize() {
    let categorized = 0;
    let created: string[] = [];
    commit((current) => {
      const res = autoCategorizeUncategorized(current);
      categorized = res.categorized;
      created = res.createdCategories;
      return res.state;
    });
    if (categorized === 0) {
      toast("Nenhuma correspondência automática encontrada", {
        description: "Clique nos itens abaixo para categorizá-los manualmente.",
      });
    } else {
      toast.success(`${categorized} lançamento(s) categorizado(s) automaticamente`, {
        description: created.length > 0 ? `Categorias criadas: ${created.join(", ")}.` : undefined,
      });
    }
  }

  return (
    <div className="grid gap-6">
      {/* Header Progress */}
      <section className="rounded-xl border bg-card p-5 shadow-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold">
              <ClipboardCheck className="size-4 text-blue-600" />
              Rotina de Fechamento • {formatMonthLabel(selectedMonth)}
            </p>
            <p className="pt-1 text-xs text-muted-foreground">
              Revise pendências, dê baixa em faturas/contas fixas, analise seu boletim mensal e direcione a sobra para metas.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Pill tone={step1Done && step2Done ? "emerald" : "amber"}>
              {step1Done && step2Done ? "Mês pronto para fechar ✓" : `${completedCount}/4 etapas em dia`}
            </Pill>
          </div>
        </div>
      </section>

      {/* Step 1: Triage */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              {step1Done ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <AlertTriangle className="size-4 text-amber-500" />
              )}
              1. Triagem: Categorias & Duplicidades
            </CardTitle>
            {uncategorized.length > 0 ? (
              <Button size="sm" variant="outline" onClick={runAutoCategorize}>
                <Sparkles className="size-3.5 text-blue-600" /> Auto-categorizar ({uncategorized.length})
              </Button>
            ) : (
              <Pill tone="emerald">Tudo limpo</Pill>
            )}
          </div>
          <CardDescription>
            Garanta que nenhum gasto fique sem categoria e confira possíveis cobranças duplicadas antes de fechar o ciclo.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          {step1Done ? (
            <p className="text-sm text-emerald-700 dark:text-emerald-400">
              Todos os lançamentos de {formatMonthLabel(selectedMonth)} estão categorizados e sem suspeita de duplicidade.
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-muted-foreground">
                  Sem categoria ({uncategorized.length} • {formatBRL(sumMoney(uncategorized.map((t) => netExpenseAmount(state, t))))})
                </p>
                {uncategorized.length === 0 ? (
                  <p className="text-xs text-emerald-600">Nenhum gasto sem categoria ✓</p>
                ) : (
                  <ul className="divide-y rounded-lg border">
                    {uncategorized.slice(0, 8).map((tx) => (
                      <li key={tx.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(tx.id)}
                          className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-xs hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <p className="truncate font-medium">{tx.clean_title}</p>
                            <p className="num text-muted-foreground">{formatDateBR(tx.date)}</p>
                          </div>
                          <span className="num shrink-0 font-semibold">{formatBRL(netExpenseAmount(state, tx))}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-muted-foreground">Suspeitas de duplicidade ({duplicates.length})</p>
                {duplicates.length === 0 ? (
                  <p className="text-xs text-emerald-600">Nenhuma duplicidade detectada ✓</p>
                ) : (
                  <ul className="grid gap-2">
                    {duplicates.map((group) => (
                      <li key={group[0].id} className="rounded-lg border border-amber-200 bg-amber-50/50 p-2.5 text-xs dark:border-amber-500/30 dark:bg-amber-500/10">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-medium">
                            {group[0].clean_title} ({group.length}x {formatBRL(group[0].amount)})
                          </span>
                          <Button size="sm" variant="outline" className="h-6 text-[11px]" onClick={() => openEdit(group[0].id)}>
                            Revisar
                          </Button>
                        </div>
                        <p className="num pt-0.5 text-muted-foreground">{formatDateBR(group[0].date)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Step 2: Invoices & Recurring Bills */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              {step2Done ? (
                <CheckCircle2 className="size-4 text-emerald-600" />
              ) : (
                <CreditCard className="size-4 text-blue-600" />
              )}
              2. Faturas de Cartão & Contas Fixas
            </CardTitle>
            <Pill tone={step2Done ? "emerald" : "amber"}>
              {step2Done ? "Todas pagas ✓" : `${openCards.length} fatura(s) e ${pendingSubs.length} fixa(s) em aberto`}
            </Pill>
          </div>
          <CardDescription>Confirme em 1 clique o pagamento das faturas e assinaturas/contas do ciclo.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <CreditCard className="size-3.5" /> Faturas de cartão ({cardSummaries.length})
            </p>
            {cardSummaries.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhum cartão cadastrado.</p>
            ) : (
              <ul className="grid gap-2">
                {cardSummaries.map((s) => {
                  const due = Math.max(0, sumMoney([s.spent, -s.payments]));
                  return (
                    <li key={s.card.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-xs">
                      <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium">
                          <span className="size-2 rounded-full" style={{ backgroundColor: s.card.color }} />
                          <span className="truncate">{s.card.name}</span>
                        </p>
                        <p className="num text-muted-foreground">
                          Fatura: {formatBRL(s.spent)} {s.isPaid ? "• Paga ✓" : due > 0 ? `• Em aberto ${formatBRL(due)}` : "• Zerada"}
                        </p>
                      </div>
                      {s.isPaid || s.spent <= 0 ? (
                        <Pill tone="emerald">{s.spent <= 0 ? "Zerada" : "Paga"}</Pill>
                      ) : (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          onClick={() => {
                            commit((current) =>
                              payCardInvoice(current, {
                                invoice_month: selectedMonth,
                                card_id: s.card.id,
                                amount: due > 0 ? due : s.spent,
                                date: today,
                              }),
                            );
                            toast.success(`Fatura ${s.card.name} marcada como paga`);
                          }}
                        >
                          Marcar paga
                        </Button>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="grid gap-2">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
              <Repeat className="size-3.5" /> Assinaturas & Contas fixas previstas ({dueSubs.length})
            </p>
            {dueSubs.length === 0 ? (
              <p className="text-xs text-muted-foreground">Nenhuma conta fixa prevista para este mês.</p>
            ) : (
              <ul className="grid gap-2">
                {dueSubs.map(({ sub, status }) => (
                  <li key={sub.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2.5 text-xs">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{sub.title}</p>
                      <p className="num text-muted-foreground">
                        Previsto {formatBRL(sub.expected_amount)} • Dia {sub.billing_day}
                      </p>
                    </div>
                    {status.paid ? (
                      <Pill tone="emerald">
                        Paga ({formatBRL(status.paidTransaction ? Math.abs(status.paidTransaction.amount) : sub.expected_amount)})
                      </Pill>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => {
                          commit((current) =>
                            paySubscription(current, sub.id, {
                              date: today,
                              amount: sub.expected_amount,
                              invoice_month: selectedMonth,
                            }),
                          );
                          toast.success(`${sub.title} marcada como paga`);
                        }}
                      >
                        Dar baixa
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Step 3: Monthly Executive Bulletin */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <TrendingUp className="size-4 text-violet-600" /> 3. Boletim Executivo de {formatMonthLabel(selectedMonth)}
          </CardTitle>
          <CardDescription>Raio-X consolidado de resultados, disciplina diária e equilíbrio de orçamento.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Entradas</p>
              <p className="num pt-1 text-lg font-semibold text-emerald-600">{formatBRL(summary.inflow)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Saídas</p>
              <p className="num pt-1 text-lg font-semibold">{formatBRL(summary.outflow)}</p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Saldo do mês</p>
              <p className={cn("num pt-1 text-lg font-semibold", summary.balance < 0 ? "text-rose-600" : "text-emerald-600")}>
                {formatSignedBRL(summary.balance)}
              </p>
            </div>
            <div className="rounded-lg border bg-muted/20 p-3">
              <p className="text-xs text-muted-foreground">Taxa de poupança</p>
              <p className="num pt-1 text-lg font-semibold">
                {summary.savingsRate === null ? "—" : formatPercent(summary.savingsRate)}
              </p>
            </div>
          </div>

          <div className="grid gap-2.5 text-xs sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Dias de gasto zero</p>
              <p className="num pt-1 text-sm font-semibold text-emerald-600">{calendar.zeroSpendDays} dia(s)</p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Gastos formiga (≤ R$ 30)</p>
              <p className="num pt-1 text-sm font-semibold text-amber-600">
                {formatBRL(ants.total)} ({ants.count}x)
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Perfil 50 / 30 / 20</p>
              <p className="num pt-1 text-sm font-semibold">
                {nature.total > 0
                  ? `${Math.round(nature.ratios.essential * 100)} / ${Math.round(nature.ratios.lifestyle * 100)} / ${Math.round(nature.ratios.financial * 100)}`
                  : "—"}
              </p>
            </div>
            <div className="rounded-lg border p-3">
              <p className="text-muted-foreground">Maior alta vs. mês anterior</p>
              <p className="num truncate pt-1 text-sm font-semibold text-rose-600">
                {biggestJump ? `${biggestJump.name} (+${formatBRL(biggestJump.delta)})` : "Sem alta relevante"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Step 4: Allocate Surplus to Savings Goals */}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <PiggyBank className="size-4 text-emerald-600" /> 4. Destinar Sobra para Metas de Economia
            </CardTitle>
            <Pill tone={surplus > 0 ? "emerald" : "slate"}>
              Sobra disponível: {formatBRL(surplus)}
            </Pill>
          </div>
          <CardDescription>
            Transforme o saldo positivo do mês em patrimônio aportando diretamente nas suas metas.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {goals.length === 0 ? (
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4 text-xs text-muted-foreground">
              <span>Você ainda não cadastrou metas de economia (ex.: Reserva de Emergência, Viagem).</span>
              <Link href="/orcamento" className="font-medium text-blue-600 hover:underline">
                Criar metas em Orçamento & Metas →
              </Link>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {goals.map((goal) => {
                const ratio = goal.target_amount > 0 ? goal.current_amount / goal.target_amount : 0;
                const defaultVal =
                  goalInputs[goal.id] ??
                  (goal.monthly_contribution > 0
                    ? goal.monthly_contribution.toFixed(2).replace(".", ",")
                    : surplus > 0
                      ? surplus.toFixed(2).replace(".", ",")
                      : "");
                return (
                  <div key={goal.id} className="grid gap-2.5 rounded-xl border bg-muted/15 p-3.5">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{goal.title}</span>
                      <span className="num text-xs text-muted-foreground">
                        {formatBRL(goal.current_amount)} / {formatBRL(goal.target_amount)} ({formatPercent(ratio)})
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                      <div className="h-full rounded-full" style={{ width: `${Math.min(ratio, 1) * 100}%`, backgroundColor: goal.color }} />
                    </div>
                    <div className="flex items-center gap-2">
                      <Input
                        inputMode="decimal"
                        className="num h-8 text-xs"
                        placeholder="Valor do aporte"
                        value={defaultVal}
                        onChange={(e) => setGoalInputs((prev) => ({ ...prev, [goal.id]: e.target.value }))}
                      />
                      <Button
                        size="sm"
                        className="h-8 shrink-0 text-xs"
                        onClick={() => {
                          const parsed = parseAmount(defaultVal);
                          if (!parsed || parsed <= 0) return toast.error("Informe um valor positivo.");
                          commit((current) => contributeSavingsGoal(current, goal.id, parsed));
                          toast.success(`Aporte de ${formatBRL(parsed)} registrado em ${goal.title}`);
                        }}
                      >
                        Aportar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

