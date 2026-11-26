"use client";

import { Calculator, Plus, Wallet, X } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { Pill } from "@/components/common/pill";
import { SourceBadge } from "@/components/common/source-badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { addMonths, cycleBounds, formatDateBR, formatMonthLabel, monthRange } from "@/lib/dates";
import { createTransaction, splitInstallments, updateSettings } from "@/lib/domain/operations";
import type { InvoiceMonth } from "@/lib/domain/types";
import {
  committedFor,
  expectedIncomeForMonth,
  expectedMonthlyIncome,
  incomeTotal,
  invoiceTotal,
  subscriptionAppliesToMonth,
  totalBudget,
  transactionsOfMonth,
} from "@/lib/finance/metrics";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function ProjectionView() {
  const { state, commit, currentMonth, today } = useFinance();
  const { openCreate, openEdit } = useDialogs();
  const [openMonth, setOpenMonth] = useState<InvoiceMonth | null>(null);
  const [incomeText, setIncomeText] = useState(state.settings.monthly_income.toFixed(2).replace(".", ","));

  // "Cabe no bolso?" installment simulator
  const [simTitle, setSimTitle] = useState("");
  const [simTotalText, setSimTotalText] = useState("");
  const [simParcelsText, setSimParcelsText] = useState("10");
  const [simStartMonth, setSimStartMonth] = useState(() => addMonths(currentMonth, 1));

  const budget = totalBudget(state.categories);
  const baselineIncome = expectedMonthlyIncome(state);
  const usesSources = state.income_sources.length > 0;
  const months = monthRange(currentMonth, 12);

  const simTotal = parseAmount(simTotalText) ?? 0;
  const simParcels = Math.max(1, Math.min(48, Math.trunc(Number(simParcelsText) || 1)));
  const simActive = simTotal > 0;
  const simMap = useMemo(() => {
    const map = new Map<InvoiceMonth, number>();
    if (!simActive) return map;
    const amounts = splitInstallments(simTotal, simParcels);
    amounts.forEach((value, idx) => {
      map.set(addMonths(simStartMonth, idx), value);
    });
    return map;
  }, [simActive, simTotal, simParcels, simStartMonth]);

  const rows = months.map((month) => {
    const commitment = committedFor(state, month, currentMonth, today);
    const isCurrent = month === currentMonth;
    const realized = isCurrent ? invoiceTotal(state, month) : null;
    const extraIncome = incomeTotal(state, month);
    const expected = isCurrent ? Math.max(realized ?? 0, commitment.total) : commitment.total;
    const plannedIncome = expectedIncomeForMonth(state, month);
    const monthIncome = extraIncome > 0 ? extraIncome : plannedIncome;
    const simExtra = simMap.get(month) ?? 0;
    const free = sumMoney([monthIncome, -expected]);
    const freeWithSim = sumMoney([free, -simExtra]);
    return { month, commitment, realized, expected, monthIncome, free, simExtra, freeWithSim };
  });

  const tightSimMonths = simActive ? rows.filter((row) => row.simExtra > 0 && row.freeWithSim < 0) : [];

  const items = openMonth ? transactionsOfMonth(state, openMonth).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const projectedSubs = openMonth
    ? state.recurring_subscriptions.filter(
        (sub) => subscriptionAppliesToMonth(sub, openMonth) && !items.some((tx) => tx.subscription_id === sub.id),
      )
    : [];

  function launchSimulatedPurchase() {
    if (!simActive) return;
    const title = simTitle.trim() || "Compra simulada";
    commit((current) =>
      createTransaction(current, {
        type: "expense",
        payment_method: "credit_card",
        card_id: state.cards[0]?.id ?? null,
        date: today,
        invoice_month: simStartMonth,
        title,
        amount: simTotal,
        category_id: null,
        notes: "Criada pelo simulador da Projeção 12 Meses",
        recurrence: simParcels > 1 ? { kind: "installments", count: simParcels } : { kind: "single" },
      }),
    );
    toast.success("Compra lançada na projeção", { description: `${title} • ${simParcels}x` });
    setSimTitle("");
    setSimTotalText("");
  }

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Premissas da projeção</CardTitle>
          <CardDescription>
            Comprometido = parcelas + assinaturas/contas devidas no mês + agendados. Rendas sazonais (13º, PLR, restituição) entram no mês previsto.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          {usesSources ? (
            <div className="grid gap-1">
              <p className="text-sm text-muted-foreground">Renda mensal base (fontes mensais ativas)</p>
              <p className="num text-xl font-semibold">{formatBRL(baselineIncome)}</p>
              <Link href="/renda" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                <Wallet className="size-3.5" /> Gerenciar salários e rendas sazonais
              </Link>
            </div>
          ) : (
            <>
              <div className="grid gap-1.5">
                <Label htmlFor="income">Renda mensal esperada (R$)</Label>
                <Input id="income" inputMode="decimal" enterKeyHint="done" className="num w-44" value={incomeText} onChange={(event) => setIncomeText(event.target.value)} />
              </div>
              <Button
                variant="outline"
                onClick={() => {
                  const value = parseAmount(incomeText);
                  if (value === null || value < 0) {
                    toast.error("Valor de renda inválido");
                    return;
                  }
                  commit((current) => updateSettings(current, { monthly_income: value }));
                  toast.success("Renda atualizada");
                }}
              >
                Salvar renda
              </Button>
            </>
          )}
          <p className="w-full text-xs text-muted-foreground sm:ml-auto sm:w-auto">
            Teto mensal das categorias: <span className="num font-medium text-foreground">{formatBRL(budget)}</span>
          </p>
        </CardContent>
      </Card>

      {/* "Cabe no bolso?" Simulator */}
      <Card className={cn(simActive && "border-blue-300 dark:border-blue-500/40")}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <Calculator className="size-4 text-blue-600" /> Simulador “Cabe no bolso?”
          </CardTitle>
          <CardDescription>
            Teste o impacto de uma compra parcelada ou avulsa nos próximos 12 meses antes de passar o cartão.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid min-w-40 flex-1 gap-1.5">
              <Label htmlFor="sim-title">O que você quer comprar?</Label>
              <Input id="sim-title" value={simTitle} onChange={(event) => setSimTitle(event.target.value)} placeholder="Ex.: Notebook novo" />
            </div>
            <div className="grid w-36 gap-1.5">
              <Label htmlFor="sim-total">Valor total (R$)</Label>
              <Input
                id="sim-total"
                inputMode="decimal"
                className="num"
                value={simTotalText}
                onChange={(event) => setSimTotalText(event.target.value)}
                placeholder="2.400,00"
              />
            </div>
            <div className="grid w-24 gap-1.5">
              <Label htmlFor="sim-parcels">Parcelas</Label>
              <Input
                id="sim-parcels"
                type="number"
                min={1}
                max={48}
                className="num"
                value={simParcelsText}
                onChange={(event) => setSimParcelsText(event.target.value)}
              />
            </div>
            <div className="grid w-40 gap-1.5">
              <Label htmlFor="sim-start">1ª fatura</Label>
              <Input id="sim-start" type="month" value={simStartMonth} onChange={(event) => setSimStartMonth(event.target.value)} />
            </div>
            {simActive ? (
              <div className="flex items-center gap-2">
                <Button size="sm" onClick={launchSimulatedPurchase}>
                  <Plus /> Lançar compra
                </Button>
                <Button
                  size="icon-sm"
                  variant="ghost"
                  aria-label="Limpar simulação"
                  onClick={() => {
                    setSimTitle("");
                    setSimTotalText("");
                  }}
                >
                  <X />
                </Button>
              </div>
            ) : null}
          </div>
          {simActive ? (
            <div
              className={cn(
                "rounded-lg border px-3 py-2 text-xs",
                tightSimMonths.length > 0
                  ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200"
                  : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200",
              )}
            >
              {tightSimMonths.length > 0 ? (
                <>
                  <strong>Atenção:</strong> {simParcels}x de{" "}
                  <span className="num font-semibold">{formatBRL(simTotal / simParcels)}</span> deixaria{" "}
                  <strong>{tightSimMonths.length} mês(es) no vermelho</strong> ({tightSimMonths.map((r) => formatMonthLabel(r.month)).join(", ")}).
                </>
              ) : (
                <>
                  <strong>Cabe no bolso!</strong> {simParcels}x de{" "}
                  <span className="num font-semibold">{formatBRL(simTotal / simParcels)}</span> mantém a folga positiva em todos os meses projetados.
                </>
              )}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
        <CardHeader className="flex flex-col gap-2.5 border-b py-4 sm:grid">
          <div>
            <CardTitle className="text-sm font-semibold">Fluxo futuro consolidado</CardTitle>
            <CardDescription>Toque em um mês para ver, editar ou adicionar lançamentos daquela competência.</CardDescription>
          </div>
          <CardAction>
            <Button size="sm" variant="outline" className="h-9 rounded-xl sm:h-8 sm:rounded-md" onClick={() => openCreate({ invoice_month: addMonths(currentMonth, 1) })}>
              <Plus /> Agendar gasto futuro
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="grid gap-2.5 bg-background/60 p-3 md:hidden" aria-label="Projeção mensal">
            {rows.map((row) => {
              const displayFree = simActive ? row.freeWithSim : row.free;
              const ratio = row.monthIncome > 0 ? Math.min(1, (row.expected + row.simExtra) / row.monthIncome) : 0;
              return (
                <li key={row.month}>
                  <button
                    type="button"
                    onClick={() => setOpenMonth(row.month)}
                    className={cn(
                      "fintech-mobile-card grid w-full gap-2 border border-border/60 p-3.5 text-left transition-transform active:scale-[0.99]",
                      row.month === currentMonth && "border-brand/50",
                    )}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-semibold">
                        {formatMonthLabel(row.month)}
                        {row.month === currentMonth ? <Pill tone="blue">Atual</Pill> : null}
                      </span>
                      <span className={cn("num text-sm font-bold", displayFree < 0 ? "text-rose-600" : "text-emerald-600")}>
                        {displayFree < 0 ? "" : "+"}
                        {formatBRL(displayFree)}
                      </span>
                    </span>
                    <span className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                      <span
                        className={cn("block h-full rounded-full", displayFree < 0 ? "bg-rose-500" : ratio > 0.8 ? "bg-amber-500" : "bg-brand")}
                        style={{ width: `${Math.max(ratio * 100, row.expected > 0 ? 4 : 0)}%` }}
                      />
                    </span>
                    <span className="num flex justify-between gap-2 text-xs text-muted-foreground">
                      <span>
                        Comprom.: {formatBRL(row.expected)}
                        {row.simExtra > 0 ? ` (+${formatBRL(row.simExtra)})` : ""}
                      </span>
                      <span className="text-emerald-600">Renda {formatBRL(row.monthIncome)}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[880px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Mês</TableHead>
                  <TableHead className="text-right">Parcelas</TableHead>
                  <TableHead className="text-right">Assinaturas</TableHead>
                  <TableHead className="text-right">Agendados</TableHead>
                  <TableHead className="text-right">Comprometido</TableHead>
                  <TableHead className="text-right">Renda</TableHead>
                  {simActive ? <TableHead className="text-right text-blue-600">Simulação</TableHead> : null}
                  <TableHead className="pr-4 text-right">{simActive ? "Folga c/ simulação" : "Folga"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => {
                  const displayFree = simActive ? row.freeWithSim : row.free;
                  return (
                    <TableRow key={row.month} className="cursor-pointer" onClick={() => setOpenMonth(row.month)}>
                      <TableCell className="pl-4 font-medium">
                        <span className="flex items-center gap-2">
                          {formatMonthLabel(row.month)}
                          {row.month === currentMonth ? <Pill tone="blue">Atual</Pill> : null}
                        </span>
                      </TableCell>
                      <TableCell className="num text-right">{formatBRL(row.commitment.installments)}</TableCell>
                      <TableCell className="num text-right">{formatBRL(row.commitment.subscriptions)}</TableCell>
                      <TableCell className="num text-right">{formatBRL(row.commitment.scheduled)}</TableCell>
                      <TableCell className="num text-right font-medium">
                        {formatBRL(row.expected)}
                        {row.realized !== null ? <div className="text-[10.5px] font-normal text-muted-foreground">fatura atual</div> : null}
                      </TableCell>
                      <TableCell className="num text-right text-emerald-600">{formatBRL(row.monthIncome)}</TableCell>
                      {simActive ? (
                        <TableCell className="num text-right text-blue-600">
                          {row.simExtra > 0 ? `+${formatBRL(row.simExtra)}` : "—"}
                        </TableCell>
                      ) : null}
                      <TableCell className={cn("num pr-4 text-right font-semibold", displayFree < 0 ? "text-rose-600" : "text-foreground")}>
                        {formatBRL(displayFree)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell className="pl-4 font-semibold">12 meses</TableCell>
                  <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.commitment.installments)))}</TableCell>
                  <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.commitment.subscriptions)))}</TableCell>
                  <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.commitment.scheduled)))}</TableCell>
                  <TableCell className="num text-right font-semibold">{formatBRL(sumMoney(rows.map((row) => row.expected)))}</TableCell>
                  <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.monthIncome)))}</TableCell>
                  {simActive ? (
                    <TableCell className="num text-right text-blue-600">
                      +{formatBRL(sumMoney(rows.map((row) => row.simExtra)))}
                    </TableCell>
                  ) : null}
                  <TableCell className="num pr-4 text-right font-semibold">
                    {formatBRL(sumMoney(rows.map((row) => (simActive ? row.freeWithSim : row.free))))}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Sheet open={openMonth !== null} onOpenChange={(open) => !open && setOpenMonth(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          {openMonth ? (
            <div className="grid gap-4 p-4">
              <SheetHeader className="p-0">
                <SheetTitle>Competência {formatMonthLabel(openMonth)}</SheetTitle>
                <SheetDescription>
                  Ciclo {formatDateBR(cycleBounds(openMonth, state.settings.closing_day).start)} até{" "}
                  {formatDateBR(cycleBounds(openMonth, state.settings.closing_day).end)}
                </SheetDescription>
              </SheetHeader>
              <Button size="sm" variant="outline" onClick={() => openCreate({ invoice_month: openMonth })}>
                <Plus /> Adicionar lançamento neste mês
              </Button>
              {items.length > 0 ? (
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Lançamentos registrados / projetados ({items.length})</p>
                  <ul className="divide-y rounded-lg border">
                    {items.map((tx) => (
                      <li key={tx.id}>
                        <button
                          type="button"
                          onClick={() => openEdit(tx.id)}
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-muted/40"
                        >
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm font-medium">{tx.clean_title}</span>
                              <SourceBadge tx={tx} />
                            </div>
                            <span className="num text-xs text-muted-foreground">{formatDateBR(tx.date)}</span>
                          </div>
                          <span className="num shrink-0 text-sm font-semibold">{formatBRL(tx.amount)}</span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {projectedSubs.length > 0 ? (
                <div className="grid gap-2">
                  <p className="text-xs font-medium text-muted-foreground">Recorrências previstas neste mês ({projectedSubs.length})</p>
                  <ul className="divide-y rounded-lg border border-dashed">
                    {projectedSubs.map((sub) => (
                      <li key={sub.id} className="flex items-center justify-between px-3 py-2 text-sm">
                        <span>{sub.title}</span>
                        <span className="num text-muted-foreground">{formatBRL(sub.expected_amount)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
