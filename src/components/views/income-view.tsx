"use client";

import { Banknote, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { Pill, type PillTone } from "@/components/common/pill";
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
import { formatDateBR, formatMonthLabel, normalizeDate } from "@/lib/dates";
import { deleteIncomeSource, receiveIncome, upsertIncomeSource } from "@/lib/domain/operations";
import { INCOME_KIND_LABEL, type IncomeKind, type IncomeSource } from "@/lib/domain/types";
import { expectedMonthlyIncome, incomeSourceMonth, type IncomeSourceMonth, type IncomeStatus } from "@/lib/finance/metrics";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

const KIND_OPTIONS = (Object.keys(INCOME_KIND_LABEL) as IncomeKind[]).map((value) => ({ value, label: INCOME_KIND_LABEL[value] }));

const STATUS: Record<IncomeStatus, { tone: PillTone; label: string }> = {
  received: { tone: "emerald", label: "Recebido" },
  partial: { tone: "amber", label: "Parcial" },
  overdue: { tone: "rose", label: "Atrasado" },
  upcoming: { tone: "slate", label: "Previsto" },
};

const HISTORY_SIZE = 12;

type Editing = { open: false } | { open: true; source: IncomeSource | null };

function amountInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function IncomeView() {
  const { state, commit, selectedMonth, today } = useFinance();
  const { openEdit } = useDialogs();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [receiving, setReceiving] = useState<IncomeSourceMonth | null>(null);
  const [removing, setRemoving] = useState<IncomeSource | null>(null);

  const months = state.income_sources.map((source) => incomeSourceMonth(state, source, selectedMonth, today));
  const active = months.filter((row) => row.source.active);
  const expected = expectedMonthlyIncome(state);
  const received = sumMoney(months.map((row) => row.receivedTotal));
  const pending = Math.max(0, sumMoney(active.map((row) => Math.max(0, row.source.expected_amount - row.receivedTotal))));

  const sourcesById = new Map(state.income_sources.map((source) => [source.id, source]));
  const history = state.transactions
    .filter((tx) => tx.income_source_id !== null && tx.type === "income")
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at))
    .slice(0, HISTORY_SIZE);

  return (
    <div className="grid gap-6">
      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumo da renda">
        <Stat label="Renda esperada por mês" value={formatBRL(expected)} hint={`${active.length} fonte(s) ativa(s)`} />
        <Stat label={`Recebido em ${formatMonthLabel(selectedMonth)}`} value={formatBRL(received)} tone="good" />
        <Stat label="Falta receber" value={formatBRL(pending)} tone={pending > 0 ? "warn" : undefined} />
      </section>

      {state.income_sources.length === 0 && state.settings.monthly_income > 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          A Projeção usa a renda manual de <span className="num font-medium text-foreground">{formatBRL(state.settings.monthly_income)}</span> até
          você cadastrar sua primeira fonte de renda.
        </p>
      ) : null}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Fontes de renda</CardTitle>
          <CardDescription>Salário, freelas e benefícios. As fontes ativas formam a renda esperada da Projeção 12 Meses.</CardDescription>
          <CardAction>
            <Button size="sm" onClick={() => setEditing({ open: true, source: null })}>
              <Plus /> Nova fonte
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {months.length === 0 ? (
            <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
              <span className="flex size-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10">
                <Banknote className="size-5" />
              </span>
              <p className="text-sm font-medium">Cadastre seu salário</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Informe quanto você recebe e em que dia. Assim o app avisa quando o pagamento está atrasado e projeta sua folga nos próximos meses.
              </p>
              <Button size="sm" onClick={() => setEditing({ open: true, source: null })}>
                <Plus /> Cadastrar fonte de renda
              </Button>
            </div>
          ) : (
            <ul className="divide-y">
              {months.map((row) => (
                <SourceRow
                  key={row.source.id}
                  row={row}
                  onReceive={() => setReceiving(row)}
                  onEdit={() => setEditing({ open: true, source: row.source })}
                  onRemove={() => setRemoving(row.source)}
                  onToggle={(checked) => {
                    commit((current) => upsertIncomeSource(current, { ...row.source, active: checked }));
                    toast.success(checked ? "Fonte reativada" : "Fonte pausada", { description: row.source.title });
                  }}
                />
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Histórico de recebimentos</CardTitle>
          <CardDescription>Últimos {HISTORY_SIZE} recebimentos vinculados a uma fonte. Toque para editar.</CardDescription>
        </CardHeader>
        <CardContent className="px-0">
          {history.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum recebimento registrado ainda.</p>
          ) : (
            <ul className="divide-y">
              {history.map((tx) => (
                <li key={tx.id}>
                  <button
                    type="button"
                    onClick={() => openEdit(tx.id)}
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/40 active:bg-muted"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{tx.clean_title}</span>
                      <span className="num block text-xs text-muted-foreground">
                        {formatDateBR(tx.date)} • {sourcesById.get(tx.income_source_id ?? "")?.title ?? "Fonte removida"} • Fatura{" "}
                        {formatMonthLabel(tx.invoice_month)}
                      </span>
                    </span>
                    <span className={cn("num shrink-0 text-sm font-semibold text-emerald-600", tx.is_ignored && "line-through opacity-60")}>
                      +{formatBRL(tx.amount)}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <SourceDialog editing={editing} onClose={() => setEditing({ open: false })} />
      <ReceiveDialog row={receiving} today={today} onClose={() => setReceiving(null)} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{removing?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os recebimentos já registrados continuam como entradas, apenas sem vínculo com esta fonte. Ela deixa de contar na renda esperada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <Button
              variant="destructive"
              onClick={() => {
                if (removing) commit((current) => deleteIncomeSource(current, removing.id));
                toast.success("Fonte de renda removida");
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

function SourceRow({
  row,
  onReceive,
  onEdit,
  onRemove,
  onToggle,
}: {
  row: IncomeSourceMonth;
  onReceive: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onToggle: (checked: boolean) => void;
}) {
  const { source, status, receivedTotal, expectedDate } = row;
  const badge = STATUS[status];
  const done = status === "received";
  return (
    <li className={cn("grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", !source.active && "opacity-60")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{source.title}</span>
          <Pill tone="blue">{INCOME_KIND_LABEL[source.kind]}</Pill>
          {source.active ? <Pill tone={badge.tone}>{badge.label}</Pill> : <Pill>Pausada</Pill>}
        </div>
        <p className="num mt-1 text-xs text-muted-foreground">
          {formatBRL(source.expected_amount)} por mês • dia {source.pay_day} (previsto {formatDateBR(expectedDate)})
          {receivedTotal > 0 ? ` • recebido ${formatBRL(receivedTotal)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {source.active ? (
          <Button size="sm" variant={done ? "outline" : "default"} onClick={onReceive} className="mr-1 flex-1 sm:flex-none">
            {done ? <Plus /> : <Check />}
            {done ? "Outro recebimento" : "Registrar recebimento"}
          </Button>
        ) : null}
        <Switch checked={source.active} aria-label={source.active ? `Pausar ${source.title}` : `Ativar ${source.title}`} onCheckedChange={onToggle} />
        <Button variant="ghost" size="icon-sm" aria-label={`Editar ${source.title}`} onClick={onEdit}>
          <Pencil />
        </Button>
        <Button variant="ghost" size="icon-sm" aria-label={`Remover ${source.title}`} onClick={onRemove}>
          <Trash2 />
        </Button>
      </div>
    </li>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "good" | "warn" }) {
  return (
    <div className="rounded-xl border bg-card p-4 shadow-panel">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("num pt-1 text-2xl font-semibold", tone === "good" && "text-emerald-600", tone === "warn" && "text-amber-600")}>{value}</p>
      {hint ? <p className="pt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

function SourceDialog({ editing, onClose }: { editing: Editing; onClose: () => void }) {
  const source = editing.open ? editing.source : null;
  return (
    <Dialog open={editing.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {editing.open ? <SourceForm key={source?.id ?? "new"} source={source} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SourceForm({ source, onDone }: { source: IncomeSource | null; onDone: () => void }) {
  const { commit } = useFinance();
  const [title, setTitle] = useState(source?.title ?? "Salário");
  const [kind, setKind] = useState<IncomeKind>(source?.kind ?? "salary");
  const [amountText, setAmountText] = useState(source ? amountInput(source.expected_amount) : "");
  const [dayText, setDayText] = useState(String(source?.pay_day ?? 5));
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseAmount(amountText);
    const day = Number(dayText);
    if (!title.trim()) return setError("Informe um nome para a fonte de renda.");
    if (amount === null || amount <= 0) return setError("Informe o valor líquido recebido por mês.");
    if (!Number.isInteger(day) || day < 1 || day > 31) return setError("O dia de pagamento vai de 1 a 31.");
    commit((current) =>
      upsertIncomeSource(current, {
        id: source?.id,
        title: title.trim(),
        kind,
        expected_amount: amount,
        pay_day: day,
        active: source?.active ?? true,
      }),
    );
    toast.success(source ? "Fonte de renda atualizada" : "Fonte de renda cadastrada", { description: `${title.trim()} • ${formatBRL(amount)}` });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{source ? "Editar fonte de renda" : "Nova fonte de renda"}</DialogTitle>
        <DialogDescription>Use o valor líquido, que realmente cai na conta. Reajustes: basta editar o valor.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="income-title">Nome</Label>
        <Input id="income-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Salário Empresa X" />
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="income-kind">Tipo</Label>
        <SimpleSelect id="income-kind" value={kind} options={KIND_OPTIONS} onChange={setKind} className="w-full" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="income-amount">Valor líquido (R$)</Label>
          <Input id="income-amount" inputMode="decimal" className="num" placeholder="0,00" value={amountText} onChange={(event) => setAmountText(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="income-day">Dia do pagamento</Label>
          <Input id="income-day" type="number" inputMode="numeric" min={1} max={31} className="num" value={dayText} onChange={(event) => setDayText(event.target.value)} />
        </div>
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Salvar</Button>
      </DialogFooter>
    </form>
  );
}

function ReceiveDialog({ row, today, onClose }: { row: IncomeSourceMonth | null; today: string; onClose: () => void }) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">{row ? <ReceiveForm key={row.source.id} row={row} today={today} onDone={onClose} /> : null}</DialogContent>
    </Dialog>
  );
}

function ReceiveForm({ row, today, onDone }: { row: IncomeSourceMonth; today: string; onDone: () => void }) {
  const { commit } = useFinance();
  const remaining = Math.max(0, row.source.expected_amount - row.receivedTotal);
  const [amountText, setAmountText] = useState(amountInput(remaining > 0 ? remaining : row.source.expected_amount));
  // Default to the expected pay date unless it is still in the future.
  const [date, setDate] = useState(row.expectedDate <= today ? row.expectedDate : today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amount = parseAmount(amountText);
    const isoDate = normalizeDate(date);
    if (amount === null || amount <= 0) return setError("Informe o valor recebido.");
    if (!isoDate) return setError("Data inválida.");
    commit((current) => receiveIncome(current, row.source.id, { date: isoDate, amount, notes }));
    toast.success("Recebimento registrado", { description: `${row.source.title} • ${formatBRL(amount)}` });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Registrar recebimento</DialogTitle>
        <DialogDescription>
          {row.source.title} • esperado {formatBRL(row.source.expected_amount)}
          {row.receivedTotal > 0 ? ` • já recebido ${formatBRL(row.receivedTotal)}` : ""}
        </DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="receive-amount">Valor recebido (R$)</Label>
          <Input id="receive-amount" inputMode="decimal" className="num" value={amountText} onChange={(event) => setAmountText(event.target.value)} />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="receive-date">Data</Label>
          <Input id="receive-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="receive-notes">Observação (opcional)</Label>
        <Input id="receive-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: adiantamento, 13º, bônus" />
      </div>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit" className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Check /> Confirmar recebimento
        </Button>
      </DialogFooter>
    </form>
  );
}
