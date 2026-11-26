"use client";

import { Check, Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { usePrivacy } from "@/components/app/privacy-provider";
import { CategoryIcon } from "@/components/common/category-icon";
import { CategorySelect } from "@/components/common/category-select";
import { Pill } from "@/components/common/pill";
import { SimpleSelect } from "@/components/common/simple-select";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateBR, formatMonthLabel } from "@/lib/dates";
import { deleteSubscription, paySubscription, upsertSubscription } from "@/lib/domain/operations";
import {
  PAYMENT_METHOD_LABEL,
  RECURRENCE_FREQUENCY_LABEL,
  type PaymentMethod,
  type RecurrenceFrequency,
  type RecurringSubscription,
} from "@/lib/domain/types";
import {
  detectRecurringCandidates,
  monthlyEquivalentAmount,
  subscriptionMonthStatus,
  type RecurringCandidate,
} from "@/lib/finance/metrics";
import { cardLabel } from "@/lib/import/issuers";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type Editing = { open: false } | { open: true; subscription: RecurringSubscription | null };

const MONTH_OPTIONS = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const FREQUENCY_OPTIONS = (Object.keys(RECURRENCE_FREQUENCY_LABEL) as RecurrenceFrequency[]).map((value) => ({
  value,
  label: RECURRENCE_FREQUENCY_LABEL[value],
}));

const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));

const NO_CARD = "__no_card__";

export function SubscriptionsView() {
  const { state, commit, selectedMonth, today } = useFinance();
  const { mask } = usePrivacy();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [removing, setRemoving] = useState<RecurringSubscription | null>(null);
  const categoriesById = new Map(state.categories.map((category) => [category.id, category]));
  const lastChargeOf = (sub: RecurringSubscription) =>
    state.transactions.filter((tx) => tx.subscription_id === sub.id).sort((a, b) => b.date.localeCompare(a.date))[0];
  const toggleActive = (sub: RecurringSubscription, checked: boolean) => {
    commit((current) => upsertSubscription(current, { ...sub, active: checked }));
    toast.success(checked ? "Recorrência ativada" : "Recorrência pausada", { description: sub.title });
  };

  const active = state.recurring_subscriptions.filter((sub) => sub.active);
  const monthlyEq = sumMoney(active.map(monthlyEquivalentAmount));
  const candidates = detectRecurringCandidates(state);

  function addCandidate(candidate: RecurringCandidate) {
    commit((current) =>
      upsertSubscription(current, {
        title: candidate.title,
        expected_amount: candidate.averageAmount,
        category_id: candidate.categoryId,
        billing_day: candidate.billingDay,
        active: true,
        frequency: "monthly",
        billing_month: null,
        payment_method: candidate.paymentMethod,
        card_id: candidate.cardId,
      }),
    );
    toast.success("Assinatura adicionada", { description: `${candidate.title} • ${formatBRL(candidate.averageAmount)}/mês` });
  }

  function markPaid(sub: RecurringSubscription) {
    const status = subscriptionMonthStatus(state, sub, selectedMonth);
    commit((current) =>
      paySubscription(current, sub.id, {
        date: status.expectedDate || today,
        amount: sub.expected_amount,
        invoice_month: selectedMonth,
      }),
    );
    toast.success("Pagamento registrado", { description: `${sub.title} em ${formatMonthLabel(selectedMonth)}` });
  }

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        <Stat label="Custo mensal" value={mask(formatBRL(monthlyEq))} className="col-span-2 sm:col-span-1" />
        <Stat label="Custo anual" value={mask(formatBRL(monthlyEq * 12))} />
        <Stat label="Ativas" value={String(active.length)} />
      </section>

      {candidates.length > 0 ? (
        <Card className="border-violet-200 bg-violet-50/40 dark:border-violet-500/30 dark:bg-violet-500/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="size-4 text-violet-600" /> Recorrências detectadas no seu histórico
            </CardTitle>
            <CardDescription>
              Estabelecimentos cobrados em 2 ou mais meses com valor parecido que ainda não estão cadastrados aqui.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-2 sm:grid-cols-2">
            {candidates.map((candidate) => (
              <div key={candidate.title} className="flex items-center justify-between gap-3 rounded-lg border bg-card px-3 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{candidate.title}</p>
                  <p className="num text-xs text-muted-foreground">
                    ~{formatBRL(candidate.averageAmount)} • {candidate.monthsCount} meses • dia {candidate.billingDay}
                  </p>
                </div>
                <Button size="sm" variant="outline" onClick={() => addCandidate(candidate)}>
                  <Plus /> Adicionar
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}

      <Card className="gap-0 overflow-hidden rounded-2xl py-0 md:rounded-xl">
        <CardHeader className="flex flex-col gap-2.5 border-b py-4 sm:grid">
          <div>
            <CardTitle className="text-sm font-semibold">Assinaturas & Contas Fixas • {formatMonthLabel(selectedMonth)}</CardTitle>
            <CardDescription>
              Suporta periodicidade mensal, trimestral, semestral e anual (IPVA, IPTU, seguros) com baixa em 1 clique.
            </CardDescription>
          </div>
          <CardAction>
            <Button size="sm" className="h-9 rounded-xl bg-brand text-white hover:bg-blue-700 sm:h-8 sm:rounded-md" onClick={() => setEditing({ open: true, subscription: null })}>
              <Plus /> Nova assinatura
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          <ul className="grid gap-2.5 bg-background/60 p-3 md:hidden" aria-label="Assinaturas">
            {state.recurring_subscriptions.map((sub) => {
              const category = sub.category_id ? categoriesById.get(sub.category_id) : undefined;
              const monthStatus = subscriptionMonthStatus(state, sub, selectedMonth);
              return (
                <li
                  key={sub.id}
                  className={cn(
                    "fintech-mobile-card grid gap-2.5 border border-border/60 p-3.5",
                    !sub.active && "opacity-60",
                  )}
                >
                  <div className="flex items-center gap-3">
                    <CategoryIcon
                      icon={category?.icon ?? "repeat"}
                      color={category?.color ?? "#8B5CF6"}
                      className="inline-flex size-10 shrink-0 items-center justify-center rounded-2xl"
                    />
                    <button
                      type="button"
                      onClick={() => setEditing({ open: true, subscription: sub })}
                      className="min-w-0 flex-1 text-left transition-opacity active:opacity-60"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{sub.title}</span>
                        <span className="num shrink-0 text-sm font-bold">{formatBRL(sub.expected_amount)}</span>
                      </span>
                      <span className="num mt-0.5 block truncate text-xs text-muted-foreground">
                        {RECURRENCE_FREQUENCY_LABEL[sub.frequency ?? "monthly"]} • dia {sub.billing_day}
                      </span>
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-2">
                    <div className="flex items-center gap-2">
                      {monthStatus.paid ? (
                        <Pill tone="emerald">Paga ✓</Pill>
                      ) : monthStatus.dueInMonth && sub.active ? (
                        <Button size="sm" variant="outline" className="h-7 rounded-xl px-2.5 text-xs" onClick={() => markPaid(sub)}>
                          <Check className="size-3.5" /> Pagar
                        </Button>
                      ) : (
                        <Pill tone="slate">Fora do ciclo</Pill>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Switch
                        checked={sub.active}
                        aria-label={sub.active ? `Pausar ${sub.title}` : `Ativar ${sub.title}`}
                        onCheckedChange={(checked) => toggleActive(sub, checked)}
                      />
                      <Button variant="ghost" size="icon-sm" aria-label={`Remover ${sub.title}`} onClick={() => setRemoving(sub)}>
                        <Trash2 className="size-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </div>
                </li>
              );
            })}
            {state.recurring_subscriptions.length === 0 ? (
              <li className="fintech-mobile-card border border-dashed px-4 py-10 text-center text-sm text-muted-foreground">
                Nenhuma conta fixa ou assinatura cadastrada.
              </li>
            ) : null}
          </ul>

          <div className="hidden overflow-x-auto md:block">
            <Table className="min-w-[820px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="pl-4">Assinatura / Conta</TableHead>
                  <TableHead>Categoria</TableHead>
                  <TableHead>Periodicidade</TableHead>
                  <TableHead>Ciclo {formatMonthLabel(selectedMonth)}</TableHead>
                  <TableHead>Última cobrança</TableHead>
                  <TableHead className="text-right">Valor previsto</TableHead>
                  <TableHead>Ativa</TableHead>
                  <TableHead className="pr-4 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {state.recurring_subscriptions.map((sub) => {
                  const category = sub.category_id ? categoriesById.get(sub.category_id) : undefined;
                  const last = lastChargeOf(sub);
                  const drift = last ? Math.abs(last.amount) - sub.expected_amount : 0;
                  const monthStatus = subscriptionMonthStatus(state, sub, selectedMonth);
                  const freq = sub.frequency ?? "monthly";
                  return (
                    <TableRow key={sub.id} className={sub.active ? undefined : "opacity-60"}>
                      <TableCell className="pl-4">
                        <div className="font-medium">{sub.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {PAYMENT_METHOD_LABEL[sub.payment_method ?? "credit_card"]} • dia {sub.billing_day}
                        </div>
                      </TableCell>
                      <TableCell>
                        {category ? (
                          <span className="flex items-center gap-2 text-sm">
                            <CategoryIcon icon={category.icon} color={category.color} /> {category.name}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        <Pill tone="slate">{RECURRENCE_FREQUENCY_LABEL[freq]}</Pill>
                        {freq !== "monthly" && sub.billing_month ? (
                          <span className="ml-1.5 text-muted-foreground">({MONTH_OPTIONS[sub.billing_month - 1]?.label})</span>
                        ) : null}
                      </TableCell>
                      <TableCell>
                        {monthStatus.paid ? (
                          <Pill tone="emerald">Paga</Pill>
                        ) : monthStatus.dueInMonth && sub.active ? (
                          <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => markPaid(sub)}>
                            <Check className="size-3.5" /> Marcar paga
                          </Button>
                        ) : (
                          <Pill tone="slate">Não vence</Pill>
                        )}
                      </TableCell>
                      <TableCell className="text-xs">
                        {last ? (
                          <span className="flex flex-wrap items-center gap-1.5">
                            <span className="num">
                              {formatDateBR(last.date)} • {formatBRL(Math.abs(last.amount))}
                            </span>
                            {Math.abs(drift) >= 0.01 ? <Pill tone="amber">{drift > 0 ? "Aumentou" : "Diminuiu"}</Pill> : null}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">Sem cobrança</span>
                        )}
                      </TableCell>
                      <TableCell className="num text-right font-medium">{formatBRL(sub.expected_amount)}</TableCell>
                      <TableCell>
                        <Switch
                          checked={sub.active}
                          aria-label={sub.active ? `Pausar ${sub.title}` : `Ativar ${sub.title}`}
                          onCheckedChange={(checked) => toggleActive(sub, checked)}
                        />
                      </TableCell>
                      <TableCell className="pr-4 text-right">
                        <Button variant="ghost" size="icon-sm" aria-label={`Editar ${sub.title}`} onClick={() => setEditing({ open: true, subscription: sub })}>
                          <Pencil />
                        </Button>
                        <Button variant="ghost" size="icon-sm" aria-label={`Remover ${sub.title}`} onClick={() => setRemoving(sub)}>
                          <Trash2 />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {state.recurring_subscriptions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="py-10 text-center text-sm text-muted-foreground">
                      Nenhuma conta fixa ou assinatura. Use “Marcar como Assinatura” em um lançamento ou crie uma nova.
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <SubscriptionDialog editing={editing} onClose={() => setEditing({ open: false })} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{removing?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Ela deixa de projetar os próximos meses. Cobranças já lançadas permanecem, apenas sem vínculo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) commit((current) => deleteSubscription(current, removing.id));
                toast.success("Recorrência removida");
                setRemoving(null);
              }}
            >
              Remover
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function SubscriptionDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  return (
    <Dialog open={editing.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {editing.open ? <SubscriptionForm key={editing.subscription?.id ?? "new"} subscription={editing.subscription} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SubscriptionForm({ subscription, onDone }: { subscription: RecurringSubscription | null; onDone: () => void }) {
  const { state, commit } = useFinance();
  const [title, setTitle] = useState(subscription?.title ?? "");
  const [amount, setAmount] = useState(subscription ? subscription.expected_amount.toFixed(2).replace(".", ",") : "");
  const [day, setDay] = useState(String(subscription?.billing_day ?? 10));
  const [categoryId, setCategoryId] = useState<string | null>(subscription?.category_id ?? null);
  const [frequency, setFrequency] = useState<RecurrenceFrequency>(subscription?.frequency ?? "monthly");
  const [billingMonth, setBillingMonth] = useState(String(subscription?.billing_month ?? 1));
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(subscription?.payment_method ?? "credit_card");
  const [cardId, setCardId] = useState<string>(subscription?.card_id ?? NO_CARD);
  const [error, setError] = useState<string | null>(null);

  const cardOptions = [{ value: NO_CARD, label: "Sem cartão vinculado" }, ...state.cards.map((card) => ({ value: card.id, label: cardLabel(card) }))];

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = parseAmount(amount);
    const parsedDay = Number(day);
    if (!title.trim()) return setError("Informe o nome.");
    if (parsedAmount === null || parsedAmount < 0) return setError("Valor inválido.");
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) return setError("Dia entre 1 e 31.");

    commit((current) =>
      upsertSubscription(current, {
        id: subscription?.id,
        title: title.trim(),
        expected_amount: parsedAmount,
        category_id: categoryId,
        billing_day: parsedDay,
        active: subscription?.active ?? true,
        frequency,
        billing_month: frequency === "monthly" ? null : Number(billingMonth),
        payment_method: paymentMethod,
        card_id: paymentMethod === "credit_card" && cardId !== NO_CARD ? cardId : null,
      }),
    );
    toast.success(subscription ? "Recorrência atualizada" : "Recorrência criada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{subscription ? "Editar conta / assinatura" : "Nova conta fixa ou assinatura"}</DialogTitle>
        <DialogDescription>Entra automaticamente na projeção dos meses em que vence.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="sub-title">Nome</Label>
        <Input id="sub-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Spotify, Aluguel, IPVA" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="sub-amount">Valor previsto (R$)</Label>
          <Input id="sub-amount" inputMode="decimal" className="num" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sub-day">Dia de cobrança</Label>
          <Input id="sub-day" type="number" min={1} max={31} className="num" value={day} onChange={(event) => setDay(event.target.value)} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Periodicidade</Label>
          <SimpleSelect value={frequency} options={FREQUENCY_OPTIONS} onChange={setFrequency} className="w-full" />
        </div>
        {frequency !== "monthly" ? (
          <div className="grid gap-1.5">
            <Label>Mês base</Label>
            <SimpleSelect value={billingMonth} options={MONTH_OPTIONS} onChange={setBillingMonth} className="w-full" />
          </div>
        ) : (
          <div className="grid gap-1.5">
            <Label>Categoria</Label>
            <CategorySelect categories={state.categories} value={categoryId} onChange={setCategoryId} className="w-full" />
          </div>
        )}
      </div>
      {frequency !== "monthly" ? (
        <div className="grid gap-1.5">
          <Label>Categoria</Label>
          <CategorySelect categories={state.categories} value={categoryId} onChange={setCategoryId} className="w-full" />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Forma de pagamento</Label>
          <SimpleSelect value={paymentMethod} options={METHOD_OPTIONS} onChange={setPaymentMethod} className="w-full" />
        </div>
        {paymentMethod === "credit_card" && state.cards.length > 0 ? (
          <div className="grid gap-1.5">
            <Label>Cartão</Label>
            <SimpleSelect value={cardId} options={cardOptions} onChange={setCardId} className="w-full" />
          </div>
        ) : null}
      </div>
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

function Stat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card p-3.5 shadow-panel sm:rounded-xl sm:p-4", className)}>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className="num pt-1 text-lg font-bold tracking-tight sm:text-2xl sm:font-semibold">{value}</p>
    </div>
  );
}
