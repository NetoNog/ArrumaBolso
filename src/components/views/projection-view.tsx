"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
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
import { updateSettings } from "@/lib/domain/operations";
import type { InvoiceMonth } from "@/lib/domain/types";
import { committedFor, incomeTotal, invoiceTotal, totalBudget, transactionsOfMonth } from "@/lib/finance/metrics";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function ProjectionView() {
  const { state, commit, currentMonth, today } = useFinance();
  const { openCreate, openEdit } = useDialogs();
  const [openMonth, setOpenMonth] = useState<InvoiceMonth | null>(null);
  const [incomeText, setIncomeText] = useState(state.settings.monthly_income.toFixed(2).replace(".", ","));

  const budget = totalBudget(state.categories);
  const income = state.settings.monthly_income;
  const months = monthRange(currentMonth, 12);
  const rows = months.map((month) => {
    const commitment = committedFor(state, month, currentMonth, today);
    const isCurrent = month === currentMonth;
    const realized = isCurrent ? invoiceTotal(state, month) : null;
    const extraIncome = incomeTotal(state, month);
    const expected = isCurrent ? Math.max(realized ?? 0, commitment.total) : commitment.total;
    const monthIncome = extraIncome > 0 ? extraIncome : income;
    return { month, commitment, realized, expected, monthIncome, free: sumMoney([monthIncome, -expected]) };
  });

  const items = openMonth ? transactionsOfMonth(state, openMonth).sort((a, b) => a.date.localeCompare(b.date)) : [];
  const projectedSubs = openMonth
    ? state.recurring_subscriptions.filter(
        (sub) => sub.active && !items.some((tx) => tx.subscription_id === sub.id),
      )
    : [];

  return (
    <div className="grid gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Premissas da projeção</CardTitle>
          <CardDescription>
            Comprometido = parcelas + assinaturas ativas + lançamentos manuais agendados. Receitas lançadas no mês substituem a renda padrão.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="grid gap-1.5">
            <Label htmlFor="income">Renda mensal esperada (R$)</Label>
            <Input id="income" inputMode="decimal" className="num w-44" value={incomeText} onChange={(event) => setIncomeText(event.target.value)} />
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
          <p className="ml-auto text-xs text-muted-foreground">
            Teto mensal das categorias: <span className="num font-medium text-foreground">{formatBRL(budget)}</span>
          </p>
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Fluxo futuro consolidado</CardTitle>
          <CardDescription>Clique em um mês para ver, editar ou adicionar lançamentos daquela competência.</CardDescription>
          <CardAction>
            <Button size="sm" variant="outline" onClick={() => openCreate({ invoice_month: addMonths(currentMonth, 1) })}>
              <Plus /> Agendar gasto futuro
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table className="min-w-[860px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Mês</TableHead>
                <TableHead className="text-right">Parcelas</TableHead>
                <TableHead className="text-right">Assinaturas</TableHead>
                <TableHead className="text-right">Agendados</TableHead>
                <TableHead className="text-right">Comprometido</TableHead>
                <TableHead className="text-right">Renda</TableHead>
                <TableHead className="pr-4 text-right">Folga</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => (
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
                  <TableCell className={cn("num pr-4 text-right font-semibold", row.free < 0 ? "text-rose-600" : "text-foreground")}>
                    {formatBRL(row.free)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
            <TableFooter>
              <TableRow>
                <TableCell className="pl-4 font-semibold">12 meses</TableCell>
                <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.commitment.installments)))}</TableCell>
                <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.commitment.subscriptions)))}</TableCell>
                <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.commitment.scheduled)))}</TableCell>
                <TableCell className="num text-right font-semibold">{formatBRL(sumMoney(rows.map((row) => row.expected)))}</TableCell>
                <TableCell className="num text-right">{formatBRL(sumMoney(rows.map((row) => row.monthIncome)))}</TableCell>
                <TableCell className="num pr-4 text-right font-semibold">{formatBRL(sumMoney(rows.map((row) => row.free)))}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </CardContent>
      </Card>

      <Sheet open={openMonth !== null} onOpenChange={(open) => !open && setOpenMonth(null)}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          {openMonth ? (
            <>
              <SheetHeader>
                <SheetTitle>Competência {formatMonthLabel(openMonth)}</SheetTitle>
                <SheetDescription>
                  Ciclo {formatDateBR(cycleBounds(openMonth, state.settings.closing_day).start)} a{" "}
                  {formatDateBR(cycleBounds(openMonth, state.settings.closing_day).end)}
                </SheetDescription>
              </SheetHeader>
              <div className="grid gap-2 px-4 pb-6">
                <Button size="sm" variant="outline" onClick={() => openCreate({ invoice_month: openMonth })}>
                  <Plus /> Adicionar neste mês
                </Button>
                {items.map((tx) => (
                  <button
                    key={tx.id}
                    type="button"
                    onClick={() => openEdit(tx.id)}
                    className="flex items-center gap-2 rounded-lg border px-3 py-2 text-left hover:bg-muted/50"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tx.clean_title}</p>
                      <p className="num text-[11px] text-muted-foreground">
                        {formatDateBR(tx.date)}
                        {tx.installment_total ? ` • parcela ${tx.installment_current}/${tx.installment_total}` : ""}
                      </p>
                    </div>
                    <SourceBadge tx={tx} />
                    <span className={cn("num text-sm", tx.type !== "expense" && "text-emerald-600")}>{formatBRL(tx.amount)}</span>
                  </button>
                ))}
                {projectedSubs.map((sub) => (
                  <div key={sub.id} className="flex items-center gap-2 rounded-lg border border-dashed px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{sub.title}</p>
                      <p className="text-[11px] text-muted-foreground">Assinatura prevista • dia {sub.billing_day}</p>
                    </div>
                    <Pill tone="violet">Assinatura</Pill>
                    <span className="num text-sm">{formatBRL(sub.expected_amount)}</span>
                  </div>
                ))}
                {items.length === 0 && projectedSubs.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">Nada lançado nesta competência.</p>
                ) : null}
              </div>
            </>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
