"use client";

import { Check, CheckCircle2, CreditCard, FastForward, Pencil, Sparkles, Star, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { CategorySelect } from "@/components/common/category-select";
import { usePrivacy } from "@/components/app/privacy-provider";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { compareMonths, formatMonthLabel } from "@/lib/dates";
import {
  activeCards,
  anticipateInstallments,
  payCardInvoice,
  updateInstallmentGroup,
  upsertInvoiceReconciliation,
} from "@/lib/domain/operations";
import {
  CARD_BRAND_LABEL,
  type InvoiceMonth,
  type InvoiceReconciliation,
  type ReconciliationStatus,
} from "@/lib/domain/types";
import {
  bestCardToBuyToday,
  cardMonthlySummary,
  expensesOfMonth,
  installmentGroups,
  invoiceMonthsWithData,
  invoiceTotal,
  paymentsTotal,
  type CardMonthlySummary,
  type InstallmentGroup,
} from "@/lib/finance/metrics";
import { cardLabel } from "@/lib/import/issuers";
import { formatBRL, formatPercent, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

const NO_CARD = "__no_card__";

export function InvoicesView() {
  const { state, commit, currentMonth, selectedMonth, setSelectedMonth, selectedCardId, setSelectedCardId, today } = useFinance();
  const { openEdit, openDelete } = useDialogs();
  const { mask } = usePrivacy();
  const [editingGroup, setEditingGroup] = useState<InstallmentGroup | null>(null);
  const [anticipatingGroup, setAnticipatingGroup] = useState<InstallmentGroup | null>(null);
  const [reconcilingMonth, setReconcilingMonth] = useState<InvoiceMonth | null>(null);

  const months = invoiceMonthsWithData(state, selectedCardId).reverse();
  const groups = installmentGroups(state, currentMonth, selectedCardId);
  const active = groups.filter((group) => compareMonths(group.lastMonth, currentMonth) >= 0);
  const finished = groups.filter((group) => compareMonths(group.lastMonth, currentMonth) < 0);
  const futureLoad = sumMoney(active.map((group) => group.remainingAmount));

  const mainCards = activeCards(state).filter((card) => !card.parent_card_id);
  const cardSummaries = mainCards.map((card) => cardMonthlySummary(state, card, selectedMonth, today));
  const bestCards = bestCardToBuyToday(state, today);

  const reconciliationFor = (month: InvoiceMonth): InvoiceReconciliation | undefined =>
    (state.invoice_reconciliations ?? []).find(
      (rec) => rec.invoice_month === month && (rec.card_id ?? null) === (selectedCardId ?? null),
    );

  function quickPayCard(summary: CardMonthlySummary) {
    const amount = summary.spent > 0 ? summary.spent : summary.unpaidPastBalance;
    if (amount <= 0) return;
    commit((current) =>
      payCardInvoice(current, {
        invoice_month: selectedMonth,
        card_id: summary.card.id,
        amount,
        date: today,
      }),
    );
    toast.success(`Fatura ${summary.card.name} marcada como paga`, {
      description: `Pagamento de ${formatBRL(amount)} registrado em ${formatMonthLabel(selectedMonth)}.`,
    });
  }

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Saldo futuro" value={mask(formatBRL(futureLoad))} className="col-span-2 sm:col-span-1" />
        <Stat label="Parcelas ativas" value={String(active.length)} />
        <Stat label="Faturas" value={String(months.length)} />
      </section>

      {/* Best card to buy today spotlight */}
      {bestCards.length >= 1 ? (
        <Card className="border-emerald-200 bg-emerald-50/40 dark:border-emerald-500/30 dark:bg-emerald-500/10">
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-emerald-600" /> Melhor cartão para comprar hoje
            </CardTitle>
            <CardDescription>
              Calculado pelo dia de fechamento e vencimento de cada cartão para maximizar o prazo de pagamento.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap items-center gap-2.5">
            {bestCards.map((item, idx) => (
              <button
                key={item.card.id}
                type="button"
                onClick={() => setSelectedCardId(selectedCardId === item.card.id ? null : item.card.id)}
                className={cn(
                  "flex items-center gap-2.5 rounded-lg border bg-card px-3 py-2 text-left transition-colors hover:bg-muted/40",
                  idx === 0 && "border-emerald-400 ring-1 ring-emerald-400/50",
                )}
              >
                <span className="size-2.5 rounded-full" style={{ backgroundColor: item.card.color }} />
                <div>
                  <div className="flex items-center gap-1.5 text-sm font-semibold">
                    {item.card.name}
                    {idx === 0 ? <Pill tone="emerald">Melhor hoje</Pill> : null}
                  </div>
                  <p className="num text-xs text-muted-foreground">
                    ~{item.daysUntilPayment} dias até pagar • fecha em {item.daysToClose === 0 ? "hoje" : `${item.daysToClose}d`}
                  </p>
                </div>
              </button>
            ))}
          </CardContent>
        </Card>
      ) : null}

      {/* Rich Mini-Card Tiles */}
      {cardSummaries.length > 0 ? (
        <section className="grid gap-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold">Seus Cartões • {formatMonthLabel(selectedMonth)}</h2>
            {selectedCardId ? (
              <Button size="sm" variant="ghost" onClick={() => setSelectedCardId(null)}>
                Mostrar todos os cartões
              </Button>
            ) : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {cardSummaries.map((summary) => {
              const activeFilter = selectedCardId === summary.card.id;
              return (
                <div
                  key={summary.card.id}
                  onClick={() => setSelectedCardId(activeFilter ? null : summary.card.id)}
                  className={cn(
                    "relative grid cursor-pointer gap-3 overflow-hidden rounded-xl border bg-card p-4 shadow-panel transition-colors hover:bg-muted/20",
                    activeFilter && "border-blue-500 ring-1 ring-blue-500",
                  )}
                >
                  <div className="absolute inset-x-0 top-0 h-1" style={{ backgroundColor: summary.card.color }} />

                  <div className="flex items-start justify-between gap-2 pt-1">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="truncate text-sm font-semibold">{cardLabel(summary.card)}</span>
                        {summary.card.brand ? <Pill tone="slate">{CARD_BRAND_LABEL[summary.card.brand]}</Pill> : null}
                        {summary.card.is_default ? <Star className="size-3.5 text-amber-500" /> : null}
                      </div>
                      <p className="num text-xs text-muted-foreground">
                        Fecha dia {summary.closingDay}
                        {summary.daysToClose !== null ? ` (${summary.daysToClose === 0 ? "hoje" : `em ${summary.daysToClose}d`})` : ""}
                        {summary.dueDay ? ` • vence dia ${summary.dueDay}` : ""}
                        {summary.daysToDue !== null ? ` (${summary.daysToDue === 0 ? "hoje" : `em ${summary.daysToDue}d`})` : ""}
                      </p>
                    </div>
                    <CreditCard className="size-4 shrink-0 text-muted-foreground" />
                  </div>

                  <div className="flex items-end justify-between gap-2">
                    <div>
                      <p className="text-[11px] text-muted-foreground">Fatura {formatMonthLabel(selectedMonth)}</p>
                      <p className="num text-xl font-semibold">{formatBRL(summary.spent)}</p>
                    </div>
                    <div className="flex items-center gap-1.5" onClick={(event) => event.stopPropagation()}>
                      {summary.isPaid ? (
                        <Pill tone="emerald">Paga ✓</Pill>
                      ) : summary.spent > 0 ? (
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => quickPayCard(summary)}>
                          <Check className="size-3.5" /> Pagar fatura
                        </Button>
                      ) : (
                        <span className="num text-xs text-muted-foreground">{summary.count} compra(s)</span>
                      )}
                    </div>
                  </div>

                  {/* Real credit limit bar */}
                  {summary.limit && summary.limit > 0 && summary.limitRatio !== null ? (
                    <div className="grid gap-1">
                      <div className="flex justify-between text-[11px] text-muted-foreground">
                        <span>
                          Limite usado: <strong className="num text-foreground">{formatPercent(summary.limitRatio)}</strong>
                        </span>
                        <span className="num">Disp. {formatBRL(summary.limitAvailable ?? 0)}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            summary.limitRatio >= 0.8 ? "bg-rose-500" : summary.limitRatio >= 0.6 ? "bg-amber-500" : "bg-blue-600",
                          )}
                          style={{ width: `${Math.min(summary.limitRatio, 1) * 100}%` }}
                        />
                      </div>
                      <p className="num text-[10.5px] text-muted-foreground">
                        {summary.unpaidPastBalance > 0 ? `Em aberto ant. ${formatBRL(summary.unpaidPastBalance)} • ` : ""}
                        {summary.futureInstallments > 0 ? `Parcelas fut. ${formatBRL(summary.futureInstallments)} • ` : ""}
                        Teto {formatBRL(summary.limit)}
                      </p>
                    </div>
                  ) : null}

                  {/* Annual fee waiver progress */}
                  {summary.waiverTarget && summary.waiverRatio !== null ? (
                    <div className="grid gap-1 border-t pt-2">
                      <div className="flex justify-between text-[11px]">
                        <span className="text-muted-foreground">Isenção de anuidade</span>
                        <span className={cn("num font-medium", summary.waiverRemaining === 0 ? "text-emerald-600" : "text-foreground")}>
                          {summary.waiverRemaining === 0 ? "Meta batida ✓" : `Faltam ${formatBRL(summary.waiverRemaining ?? 0)}`}
                        </span>
                      </div>
                      <div className="h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn("h-full rounded-full", summary.waiverRemaining === 0 ? "bg-emerald-500" : "bg-violet-500")}
                          style={{ width: `${Math.min(summary.waiverRatio, 1) * 100}%` }}
                        />
                      </div>
                    </div>
                  ) : null}

                  {/* Cashback / points estimates */}
                  {summary.estimatedCashback > 0 || summary.estimatedPoints > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {summary.estimatedCashback > 0 ? (
                        <Pill tone="emerald">Cashback est.: {formatBRL(summary.estimatedCashback)}</Pill>
                      ) : null}
                      {summary.estimatedPoints > 0 ? (
                        <Pill tone="violet">~{summary.estimatedPoints.toLocaleString("pt-BR")} pts</Pill>
                      ) : null}
                    </div>
                  ) : null}

                  {/* Virtual / additional subcards breakdown */}
                  {summary.subcards.length > 0 ? (
                    <div className="grid gap-1 border-t pt-2" onClick={(event) => event.stopPropagation()}>
                      <p className="text-[11px] font-medium text-muted-foreground">Subcartões virtuais / adicionais</p>
                      {summary.subcards.map((sub) => (
                        <button
                          key={sub.card.id}
                          type="button"
                          onClick={() => setSelectedCardId(selectedCardId === sub.card.id ? null : sub.card.id)}
                          className={cn(
                            "flex items-center justify-between rounded px-1.5 py-1 text-xs hover:bg-muted",
                            selectedCardId === sub.card.id && "bg-blue-50 font-medium text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
                          )}
                        >
                          <span className="truncate">
                            ↳ {sub.card.name}
                            {sub.card.holder_name ? ` (${sub.card.holder_name})` : ""}
                          </span>
                          <span className="num shrink-0">{formatBRL(sub.spent)}</span>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Parcelamentos em andamento</CardTitle>
          <CardDescription>
            Edite o grupo inteiro, antecipe parcelas futuras com desconto ou clique em uma parcela individual.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          {active.length === 0 ? <p className="text-sm text-muted-foreground">Nenhum parcelamento ativo.</p> : null}
          {active.map((group) => {
            const progress = group.paidCount / group.total;
            const hasFuture = group.remainingAmount > 0;
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
                          "num rounded-md border px-2 py-1 text-xs transition-colors hover:bg-muted",
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
                <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1.5">
                  <div className="text-right">
                    <p className="num text-sm font-semibold">{formatBRL(group.parcelAmount)}/mês</p>
                    <p className="num text-xs text-muted-foreground">
                      Restam {formatBRL(group.remainingAmount)} até {formatMonthLabel(group.lastMonth)}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1">
                    <Button variant="outline" size="sm" onClick={() => setEditingGroup(group)}>
                      <Pencil /> Editar grupo
                    </Button>
                    {hasFuture ? (
                      <Button variant="outline" size="sm" onClick={() => setAnticipatingGroup(group)}>
                        <FastForward /> Antecipar
                      </Button>
                    ) : null}
                    <Button variant="ghost" size="icon-sm" aria-label="Excluir grupo" onClick={() => openDelete(group.parcels.map((parcel) => parcel.id))}>
                      <Trash2 />
                    </Button>
                  </div>
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

      <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Histórico & Conferência de faturas</CardTitle>
          <CardDescription>Selecione um ciclo para analisá-lo na Visão Geral ou confira o total fechado com o banco.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="grid gap-2.5 bg-background/60 p-3 md:hidden" aria-label="Faturas">
            {months.map((month) => {
              const position = compareMonths(month, currentMonth);
              const total = invoiceTotal(state, month, selectedCardId);
              const rec = reconciliationFor(month);
              const diff = rec ? sumMoney([total, -rec.expected_total]) : null;
              return (
                <li
                  key={month}
                  className={cn(
                    "fintech-mobile-card flex items-center gap-3 border border-border/60 px-3.5 py-3",
                    month === selectedMonth && "border-brand/60 bg-blue-50/60 dark:bg-blue-500/10",
                  )}
                >
                  <button type="button" onClick={() => setSelectedMonth(month)} className="min-w-0 flex-1 text-left">
                    <span className="flex items-center gap-2">
                      <span className="text-sm font-semibold">{formatMonthLabel(month)}</span>
                      <InvoiceStatus position={position} />
                    </span>
                    <span className="num mt-0.5 block text-xs text-muted-foreground">
                      {expensesOfMonth(state, month, selectedCardId).length} compra(s) • pago {formatBRL(paymentsTotal(state, month, selectedCardId))}
                    </span>
                    {rec ? (
                      <span className={cn("num mt-1 block text-xs font-medium", Math.abs(diff ?? 0) <= 0.01 ? "text-emerald-600" : "text-amber-600")}>
                        {rec.status === "paid" ? "Paga" : "Conferida"} • banco {formatBRL(rec.expected_total)}
                        {Math.abs(diff ?? 0) > 0.01 ? ` (Δ ${formatBRL(diff ?? 0)})` : " ✓"}
                      </span>
                    ) : null}
                  </button>
                  <div className="grid justify-items-end gap-1.5">
                    <span className="num text-sm font-bold">{formatBRL(total)}</span>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 rounded-xl px-2.5 text-[11px]"
                      onClick={() => setReconcilingMonth(month)}
                    >
                      <CheckCircle2 className="size-3" /> Conferir
                    </Button>
                  </div>
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
                  <TableHead className="text-right">Total no app</TableHead>
                  <TableHead className="text-right">Pagamentos</TableHead>
                  <TableHead>Conferência bancária</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="pr-4 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {months.map((month) => {
                  const position = compareMonths(month, currentMonth);
                  const total = invoiceTotal(state, month, selectedCardId);
                  const rec = reconciliationFor(month);
                  const diff = rec ? sumMoney([total, -rec.expected_total]) : null;
                  return (
                    <TableRow
                      key={month}
                      onClick={() => setSelectedMonth(month)}
                      className={cn("cursor-pointer", month === selectedMonth && "bg-blue-50/60 dark:bg-blue-500/10")}
                    >
                      <TableCell className="pl-4 font-medium">{formatMonthLabel(month)}</TableCell>
                      <TableCell className="num text-right">{expensesOfMonth(state, month, selectedCardId).length}</TableCell>
                      <TableCell className="num text-right font-medium">{formatBRL(total)}</TableCell>
                      <TableCell className="num text-right text-emerald-600">{formatBRL(paymentsTotal(state, month, selectedCardId))}</TableCell>
                      <TableCell>
                        {rec ? (
                          <div className="flex flex-wrap items-center gap-1.5 text-xs">
                            <Pill tone={rec.status === "paid" ? "emerald" : "blue"}>{rec.status === "paid" ? "Paga" : "Conferida"}</Pill>
                            <span className="num text-muted-foreground">Banco {formatBRL(rec.expected_total)}</span>
                            {Math.abs(diff ?? 0) <= 0.01 ? (
                              <Pill tone="emerald">Batida ✓</Pill>
                            ) : (
                              <Pill tone="amber">Δ {formatBRL(diff ?? 0)}</Pill>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">Não conferida</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <InvoiceStatus position={position} />
                      </TableCell>
                      <TableCell className="pr-4 text-right" onClick={(event) => event.stopPropagation()}>
                        <Button size="sm" variant="outline" onClick={() => setReconcilingMonth(month)}>
                          <CheckCircle2 /> {rec ? "Atualizar" : "Conferir"}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={editingGroup !== null} onOpenChange={(open) => !open && setEditingGroup(null)}>
        <DialogContent className="sm:max-w-md">
          {editingGroup ? <EditGroupDialog group={editingGroup} onDone={() => setEditingGroup(null)} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={anticipatingGroup !== null} onOpenChange={(open) => !open && setAnticipatingGroup(null)}>
        <DialogContent className="sm:max-w-md">
          {anticipatingGroup ? <AnticipateDialog group={anticipatingGroup} onDone={() => setAnticipatingGroup(null)} /> : null}
        </DialogContent>
      </Dialog>

      <Dialog open={reconcilingMonth !== null} onOpenChange={(open) => !open && setReconcilingMonth(null)}>
        <DialogContent className="sm:max-w-md">
          {reconcilingMonth ? (
            <ReconcileDialog
              month={reconcilingMonth}
              existing={reconciliationFor(reconcilingMonth) ?? null}
              appTotal={invoiceTotal(state, reconcilingMonth, selectedCardId)}
              cardId={selectedCardId}
              onDone={() => setReconcilingMonth(null)}
            />
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditGroupDialog({ group, onDone }: { group: InstallmentGroup; onDone: () => void }) {
  const { state, commit } = useFinance();
  const [title, setTitle] = useState(group.title);
  const [categoryId, setCategoryId] = useState<string | null>(group.categoryId);
  const [cardId, setCardId] = useState<string>(group.cardId ?? NO_CARD);

  const cardOptions = [
    { value: NO_CARD, label: "Sem cartão vinculado" },
    ...activeCards(state).map((card) => ({ value: card.id, label: cardLabel(card) })),
  ];

  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return toast.error("Informe um título");
    commit((current) =>
      updateInstallmentGroup(current, group.groupId, {
        clean_title: title.trim(),
        category_id: categoryId,
        card_id: cardId === NO_CARD ? null : cardId,
      }),
    );
    toast.success(`${group.parcels.length} parcela(s) atualizada(s)`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Editar grupo de parcelamento</DialogTitle>
        <DialogDescription>As alterações valem para todas as {group.parcels.length} parcelas registradas deste grupo.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="eg-title">Título</Label>
        <Input id="eg-title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </div>
      <div className="grid gap-1.5">
        <Label>Categoria</Label>
        <CategorySelect categories={state.categories} value={categoryId} onChange={setCategoryId} className="w-full" />
      </div>
      {state.cards.length > 0 ? (
        <div className="grid gap-1.5">
          <Label>Cartão</Label>
          <SimpleSelect value={cardId} options={cardOptions} onChange={setCardId} className="w-full" />
        </div>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar em todas</Button>
      </DialogFooter>
    </form>
  );
}

function AnticipateDialog({ group, onDone }: { group: InstallmentGroup; onDone: () => void }) {
  const { commit, currentMonth, today } = useFinance();
  const [discountText, setDiscountText] = useState("0,00");
  const [targetMonth, setTargetMonth] = useState(currentMonth);

  const discount = Math.max(0, parseAmount(discountText) ?? 0);
  const net = Math.max(0.01, sumMoney([group.remainingAmount, -discount]));

  function submit(event: FormEvent) {
    event.preventDefault();
    commit((current) => anticipateInstallments(current, group.groupId, targetMonth, discount, today));
    toast.success("Parcelas futuras antecipadas", {
      description: `Lançamento de ${formatBRL(net)} em ${formatMonthLabel(targetMonth)}.`,
    });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Antecipar / quitar parcelas</DialogTitle>
        <DialogDescription>
          Remove as parcelas futuras de <strong>{group.title}</strong> ({formatBRL(group.remainingAmount)}) e lança a quitação na fatura escolhida.
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="ant-month">Fatura da quitação</Label>
          <Input id="ant-month" type="month" value={targetMonth} onChange={(event) => setTargetMonth(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="ant-discount">Desconto obtido (R$)</Label>
          <Input
            id="ant-discount"
            inputMode="decimal"
            className="num"
            value={discountText}
            onChange={(event) => setDiscountText(event.target.value)}
          />
        </div>
      </div>
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Saldo futuro atual</span>
          <span className="num">{formatBRL(group.remainingAmount)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">Desconto</span>
          <span className="num text-emerald-600">−{formatBRL(Math.min(discount, group.remainingAmount))}</span>
        </div>
        <div className="mt-1.5 flex justify-between border-t pt-1.5 font-semibold">
          <span>Valor líquido a lançar</span>
          <span className="num">{formatBRL(net)}</span>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">
          <FastForward /> Confirmar antecipação
        </Button>
      </DialogFooter>
    </form>
  );
}

function ReconcileDialog({
  month,
  existing,
  appTotal,
  cardId,
  onDone,
}: {
  month: InvoiceMonth;
  existing: InvoiceReconciliation | null;
  appTotal: number;
  cardId: string | null;
  onDone: () => void;
}) {
  const { commit } = useFinance();
  const [bankTotalText, setBankTotalText] = useState(
    (existing?.expected_total ?? appTotal).toFixed(2).replace(".", ","),
  );
  const [status, setStatus] = useState<ReconciliationStatus>(existing?.status ?? "checked");
  const [notes, setNotes] = useState(existing?.notes ?? "");

  const bankTotal = parseAmount(bankTotalText) ?? 0;
  const diff = sumMoney([appTotal, -bankTotal]);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = parseAmount(bankTotalText);
    if (parsed === null || parsed < 0) return toast.error("Informe um valor válido");
    commit((current) =>
      upsertInvoiceReconciliation(current, {
        id: existing?.id,
        invoice_month: month,
        card_id: cardId,
        expected_total: parsed,
        status,
        notes,
      }),
    );
    toast.success(`Fatura ${formatMonthLabel(month)} marcada como ${status === "paid" ? "Paga" : "Conferida"}`);
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4">
      <DialogHeader>
        <DialogTitle>Conferir fatura • {formatMonthLabel(month)}</DialogTitle>
        <DialogDescription>Compare o total do app com o valor oficial fechado pelo banco para encontrar divergências.</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rec-total">Total no banco (R$)</Label>
          <Input
            id="rec-total"
            inputMode="decimal"
            className="num"
            value={bankTotalText}
            onChange={(event) => setBankTotalText(event.target.value)}
            autoFocus
          />
        </div>
        <div className="grid gap-1.5">
          <Label>Status</Label>
          <SimpleSelect
            value={status}
            options={[
              { value: "checked" as ReconciliationStatus, label: "Conferida" },
              { value: "paid" as ReconciliationStatus, label: "Paga" },
            ]}
            onChange={setStatus}
            className="w-full"
          />
        </div>
      </div>
      <div className="rounded-lg border bg-muted/40 p-3 text-sm">
        <div className="flex justify-between">
          <span className="text-muted-foreground">Total calculado no app</span>
          <span className="num">{formatBRL(appTotal)}</span>
        </div>
        <div className="mt-1 flex justify-between font-semibold">
          <span>Diferença (app − banco)</span>
          <span className={cn("num", Math.abs(diff) <= 0.01 ? "text-emerald-600" : "text-amber-600")}>
            {Math.abs(diff) <= 0.01 ? "R$ 0,00 (Batida ✓)" : formatBRL(diff)}
          </span>
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rec-notes">Observações (opcional)</Label>
        <Input id="rec-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: IOF ajustado, estorno pendente..." />
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar conferência</Button>
      </DialogFooter>
    </form>
  );
}

function InvoiceStatus({ position }: { position: number }) {
  if (position < 0) return <Pill tone="slate">Fechada</Pill>;
  return position === 0 ? <Pill tone="blue">Aberta</Pill> : <Pill tone="violet">Futura</Pill>;
}

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card p-3.5 shadow-panel sm:rounded-xl sm:p-4", className)}>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className="num pt-1 text-lg font-bold tracking-tight sm:text-2xl sm:font-semibold">{value}</p>
    </div>
  );
}
