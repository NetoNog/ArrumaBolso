"use client";

import { Trash2 } from "lucide-react";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { Pill } from "@/components/common/pill";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compareMonths, formatMonthLabel } from "@/lib/dates";
import {
  expensesOfMonth,
  installmentGroups,
  invoiceMonthsWithData,
  invoiceTotal,
  paymentsTotal,
} from "@/lib/finance/metrics";
import { formatBRL, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

export function InvoicesView() {
  const { state, currentMonth, selectedMonth, setSelectedMonth } = useFinance();
  const { openEdit, openDelete } = useDialogs();
  const months = invoiceMonthsWithData(state).reverse();
  const groups = installmentGroups(state, currentMonth);
  const active = groups.filter((group) => compareMonths(group.lastMonth, currentMonth) >= 0);
  const finished = groups.filter((group) => compareMonths(group.lastMonth, currentMonth) < 0);
  const futureLoad = sumMoney(active.map((group) => group.remainingAmount));

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Parcelamentos ativos" value={String(active.length)} />
        <Stat label="Saldo futuro em parcelas" value={formatBRL(futureLoad)} />
        <Stat label="Faturas registradas" value={String(months.length)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Parcelamentos em andamento</CardTitle>
          <CardDescription>Parcelas reais (CSV) substituem automaticamente as previstas quando chega a fatura seguinte.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {active.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum parcelamento ativo.</p> : null}
          {active.map((group) => {
            const progress = group.paidCount / group.total;
            return (
              <div key={group.groupId} className="grid gap-3 rounded-xl border p-3.5 sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="grid gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{group.title}</span>
                    <Pill tone="blue">
                      {group.paidCount}/{group.total} pagas
                    </Pill>
                    {group.currentParcel === group.total ? <Pill tone="emerald">Encerrando neste ciclo</Pill> : null}
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${progress * 100}%` }} />
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {group.parcels.map((parcel) => (
                      <button
                        key={parcel.id}
                        type="button"
                        onClick={() => openEdit(parcel.id)}
                        className={cn(
                          "num rounded-md border px-2 py-1 text-[11px] transition-colors hover:bg-muted",
                          parcel.source === "projected" && "border-dashed text-muted-foreground",
                          parcel.invoice_month === currentMonth && "border-blue-300 bg-blue-50 text-blue-800 dark:border-blue-500/40 dark:bg-blue-500/10 dark:text-blue-200",
                        )}
                        title={parcel.source === "projected" ? "Prevista (será substituída pela real)" : "Lançada"}
                      >
                        {parcel.installment_current}/{parcel.installment_total} • {formatMonthLabel(parcel.invoice_month)} • {formatBRL(parcel.amount)}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-4 sm:flex-col sm:items-end sm:gap-1">
                  <div className="text-right">
                    <p className="num text-sm font-semibold">{formatBRL(group.parcelAmount)}/mês</p>
                    <p className="num text-xs text-muted-foreground">
                      Restam {formatBRL(group.remainingAmount)} até {formatMonthLabel(group.lastMonth)}
                    </p>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => openDelete(group.parcels.map((parcel) => parcel.id))}>
                    <Trash2 /> Excluir grupo
                  </Button>
                </div>
              </div>
            );
          })}
          {finished.length > 0 ? (
            <p className="text-xs text-muted-foreground">
              {finished.length} parcelamento(s) já quitado(s): {finished.map((group) => group.title).join(", ")}.
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Histórico de faturas</CardTitle>
          <CardDescription>Selecione um ciclo para analisá-lo na Visão Geral.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="divide-y md:hidden" aria-label="Faturas">
            {months.map((month) => {
              const position = compareMonths(month, currentMonth);
              return (
                <li key={month}>
                  <button
                    type="button"
                    onClick={() => setSelectedMonth(month)}
                    aria-current={month === selectedMonth}
                    className={cn(
                      "flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-muted",
                      month === selectedMonth && "bg-blue-50/60 dark:bg-blue-500/10",
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">{formatMonthLabel(month)}</span>
                      <span className="num block text-xs text-muted-foreground">
                        {expensesOfMonth(state, month).length} compra(s) • pago {formatBRL(paymentsTotal(state, month))}
                      </span>
                    </span>
                    <span className="grid justify-items-end gap-1">
                      <span className="num text-sm font-semibold">{formatBRL(invoiceTotal(state, month))}</span>
                      <InvoiceStatus position={position} />
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          <div className="hidden overflow-x-auto md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Fatura</TableHead>
                <TableHead className="text-right">Compras</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Pagamentos</TableHead>
                <TableHead className="pr-4 text-right">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {months.map((month) => {
                const position = compareMonths(month, currentMonth);
                return (
                  <TableRow
                    key={month}
                    onClick={() => setSelectedMonth(month)}
                    className={cn("cursor-pointer", month === selectedMonth && "bg-blue-50/60 dark:bg-blue-500/10")}
                  >
                    <TableCell className="pl-4 font-medium">{formatMonthLabel(month)}</TableCell>
                    <TableCell className="num text-right">{expensesOfMonth(state, month).length}</TableCell>
                    <TableCell className="num text-right font-medium">{formatBRL(invoiceTotal(state, month))}</TableCell>
                    <TableCell className="num text-right text-emerald-600">{formatBRL(paymentsTotal(state, month))}</TableCell>
                    <TableCell className="pr-4 text-right">
                      <InvoiceStatus position={position} />
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
  );
}

function InvoiceStatus({ position }: { position: number }) {
  if (position < 0) return <Pill tone="slate">Fechada</Pill>;
  return position === 0 ? <Pill tone="blue">Aberta</Pill> : <Pill tone="violet">Futura</Pill>;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-panel">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="num pt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
