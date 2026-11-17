"use client";

import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { CategoryIcon } from "@/components/common/category-icon";
import { CategorySelect } from "@/components/common/category-select";
import { Pill } from "@/components/common/pill";
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
import { formatDateBR } from "@/lib/dates";
import { deleteSubscription, upsertSubscription } from "@/lib/domain/operations";
import type { RecurringSubscription } from "@/lib/domain/types";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type Editing = { open: false } | { open: true; subscription: RecurringSubscription | null };

export function SubscriptionsView() {
  const { state, commit } = useFinance();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [removing, setRemoving] = useState<RecurringSubscription | null>(null);
  const categoriesById = new Map(state.categories.map((category) => [category.id, category]));

  const active = state.recurring_subscriptions.filter((sub) => sub.active);
  const monthly = sumMoney(active.map((sub) => sub.expected_amount));

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-3">
        <Stat label="Assinaturas ativas" value={String(active.length)} />
        <Stat label="Custo mensal previsto" value={formatBRL(monthly)} />
        <Stat label="Custo anualizado" value={formatBRL(monthly * 12)} />
      </section>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Assinaturas Fixas</CardTitle>
          <CardDescription>Assinaturas ativas entram automaticamente no comprometido dos meses futuros.</CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setEditing({ open: true, subscription: null })}>
              <Plus /> Nova assinatura
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="overflow-x-auto px-0">
          <Table className="min-w-[720px]">
            <TableHeader>
              <TableRow>
                <TableHead className="pl-4">Assinatura</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Dia</TableHead>
                <TableHead>Última cobrança</TableHead>
                <TableHead className="text-right">Valor previsto</TableHead>
                <TableHead>Ativa</TableHead>
                <TableHead className="pr-4 text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {state.recurring_subscriptions.map((sub) => {
                const category = sub.category_id ? categoriesById.get(sub.category_id) : undefined;
                const charges = state.transactions.filter((tx) => tx.subscription_id === sub.id).sort((a, b) => b.date.localeCompare(a.date));
                const last = charges[0];
                const drift = last ? Math.abs(last.amount) - sub.expected_amount : 0;
                return (
                  <TableRow key={sub.id} className={sub.active ? undefined : "opacity-60"}>
                    <TableCell className="pl-4 font-medium">{sub.title}</TableCell>
                    <TableCell>
                      {category ? (
                        <span className="flex items-center gap-2 text-sm">
                          <CategoryIcon icon={category.icon} color={category.color} /> {category.name}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="num">{sub.billing_day}</TableCell>
                    <TableCell className="text-xs">
                      {last ? (
                        <span className="flex flex-wrap items-center gap-1.5">
                          <span className="num">
                            {formatDateBR(last.date)} • {formatBRL(Math.abs(last.amount))}
                          </span>
                          {Math.abs(drift) >= 0.01 ? <Pill tone="amber">{drift > 0 ? "Aumentou" : "Diminuiu"}</Pill> : null}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">Sem cobrança vinculada</span>
                      )}
                    </TableCell>
                    <TableCell className="num text-right font-medium">{formatBRL(sub.expected_amount)}</TableCell>
                    <TableCell>
                      <Switch
                        checked={sub.active}
                        aria-label={sub.active ? `Pausar ${sub.title}` : `Ativar ${sub.title}`}
                        onCheckedChange={(checked) => {
                          commit((current) => upsertSubscription(current, { ...sub, active: checked }));
                          toast.success(checked ? "Assinatura ativada" : "Assinatura pausada", { description: sub.title });
                        }}
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
                  <TableCell colSpan={7} className="py-10 text-center text-sm text-muted-foreground">
                    Nenhuma assinatura. Use “Marcar como Assinatura” em um lançamento ou crie uma nova.
                  </TableCell>
                </TableRow>
              ) : null}
            </TableBody>
          </Table>
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
                toast.success("Assinatura removida");
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
  const [day, setDay] = useState(String(subscription?.billing_day ?? 1));
  const [categoryId, setCategoryId] = useState<string | null>(subscription?.category_id ?? null);
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const value = parseAmount(amount);
    const billingDay = Number(day);
    if (!title.trim()) return setError("Informe o nome.");
    if (value === null || value <= 0) return setError("Informe um valor maior que zero.");
    if (!Number.isInteger(billingDay) || billingDay < 1 || billingDay > 31) return setError("Dia de cobrança entre 1 e 31.");
    commit((current) =>
      upsertSubscription(current, {
        id: subscription?.id,
        title: title.trim(),
        expected_amount: value,
        billing_day: billingDay,
        category_id: categoryId,
        active: subscription?.active ?? true,
      }),
    );
    toast.success(subscription ? "Assinatura atualizada" : "Assinatura criada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{subscription ? "Editar assinatura" : "Nova assinatura"}</DialogTitle>
        <DialogDescription>O valor previsto é usado na projeção enquanto a cobrança real não chega.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="sub-title">Nome</Label>
        <Input id="sub-title" value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="sub-amount">Valor previsto (R$)</Label>
          <Input id="sub-amount" inputMode="decimal" className="num" value={amount} onChange={(event) => setAmount(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="sub-day">Dia de cobrança</Label>
          <Input id="sub-day" type="number" min={1} max={31} className="num" value={day} onChange={(event) => setDay(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label>Categoria</Label>
        <CategorySelect categories={state.categories} value={categoryId} onChange={setCategoryId} className="w-full" />
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

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-panel">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="num pt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
