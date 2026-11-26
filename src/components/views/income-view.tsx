"use client";

import { Banknote, Check, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { useDialogs } from "@/components/app/dialogs-provider";
import { usePrivacy } from "@/components/app/privacy-provider";
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
import {
  INCOME_FREQUENCY_LABEL,
  INCOME_KIND_LABEL,
  type IncomeFrequency,
  type IncomeKind,
  type IncomeSource,
  type IsoDate,
} from "@/lib/domain/types";
import {
  expectedIncomeForMonth,
  incomeSourceMonth,
  type IncomeSourceMonth,
  type IncomeStatus,
} from "@/lib/finance/metrics";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

const KIND_OPTIONS = (Object.keys(INCOME_KIND_LABEL) as IncomeKind[]).map((value) => ({ value, label: INCOME_KIND_LABEL[value] }));
const FREQUENCY_OPTIONS = (Object.keys(INCOME_FREQUENCY_LABEL) as IncomeFrequency[]).map((value) => ({
  value,
  label: INCOME_FREQUENCY_LABEL[value],
}));
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

const STATUS: Record<IncomeStatus, { tone: PillTone; label: string }> = {
  received: { tone: "emerald", label: "Recebido" },
  partial: { tone: "amber", label: "Parcial" },
  overdue: { tone: "rose", label: "Atrasado" },
  upcoming: { tone: "slate", label: "Previsto" },
};

const HISTORY_PAGE = 20;

type Editing = { open: false } | { open: true; source: IncomeSource | null };

function amountInput(value: number): string {
  return value.toFixed(2).replace(".", ",");
}

export function IncomeView() {
  const { state, commit, selectedMonth, today } = useFinance();
  const { openEdit } = useDialogs();
  const { mask } = usePrivacy();
  const [editing, setEditing] = useState<Editing>({ open: false });
  const [receiving, setReceiving] = useState<IncomeSourceMonth | null>(null);
  const [removing, setRemoving] = useState<IncomeSource | null>(null);
  const [historyQuery, setHistoryQuery] = useState("");
  const [historyLimit, setHistoryLimit] = useState(HISTORY_PAGE);

  const months = state.income_sources.map((source) => incomeSourceMonth(state, source, selectedMonth, today));
  const dueActive = months.filter((row) => row.source.active && row.dueInMonth);
  const expected = expectedIncomeForMonth(state, selectedMonth);
  const received = sumMoney(months.map((row) => row.receivedTotal));
  const pending = Math.max(0, sumMoney(dueActive.map((row) => Math.max(0, row.source.expected_amount - row.receivedTotal))));

  const sourcesById = new Map(state.income_sources.map((source) => [source.id, source]));
  const needle = historyQuery.trim().toLowerCase();
  const allHistory = state.transactions
    .filter((tx) => tx.income_source_id !== null && tx.type === "income")
    .filter((tx) => {
      if (!needle) return true;
      const srcName = sourcesById.get(tx.income_source_id ?? "")?.title ?? "";
      return `${tx.clean_title} ${srcName} ${formatMonthLabel(tx.invoice_month)} ${tx.notes}`.toLowerCase().includes(needle);
    })
    .sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
  const history = allHistory.slice(0, historyLimit);

  return (
    <div className="grid gap-6">
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4" aria-label="Resumo da renda">
        <Stat
          label={`Renda esperada • ${formatMonthLabel(selectedMonth)}`}
          value={mask(formatBRL(expected))}
          hint={`${dueActive.length} fonte(s) prevista(s) neste mês`}
          className="col-span-2 sm:col-span-1"
        />
        <Stat label="Recebido no mês" value={mask(formatBRL(received))} tone="good" />
        <Stat label="Falta receber" value={mask(formatBRL(pending))} tone={pending > 0 ? "warn" : undefined} />
      </section>

      {state.income_sources.length === 0 && state.settings.monthly_income > 0 ? (
        <p className="rounded-lg border border-dashed px-4 py-3 text-sm text-muted-foreground">
          A Projeção usa a renda manual de <span className="num font-medium text-foreground">{formatBRL(state.settings.monthly_income)}</span> até
          você cadastrar sua primeira fonte de renda.
        </p>
      ) : null}

      <Card className="gap-0 py-0">
        <CardHeader className="border-b py-4">
          <CardTitle className="text-sm font-semibold">Fontes de renda (mensais, 13º, PLR e sazonais)</CardTitle>
          <CardDescription>Fontes mensais, anuais e pontuais entram automaticamente no mês certo da Projeção 12 Meses.</CardDescription>
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
              <p className="text-sm font-medium">Cadastre seu salário e rendas sazonais</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Informe quanto recebe e em que dia/mês. O app projeta sua folga futura incluindo 13º, férias e PLR.
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
          <CardTitle className="text-sm font-semibold">Histórico completo de recebimentos ({allHistory.length})</CardTitle>
          <CardDescription>Busque e edite qualquer recebimento vinculado às suas fontes de renda.</CardDescription>
          <CardAction className="w-full sm:w-auto">
            <div className="relative w-full sm:w-60">
              <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={historyQuery}
                onChange={(event) => {
                  setHistoryQuery(event.target.value);
                  setHistoryLimit(HISTORY_PAGE);
                }}
                placeholder="Filtrar recebimentos..."
                className="h-8 pl-8 text-xs"
              />
            </div>
          </CardAction>
        </CardHeader>
        <CardContent className="px-0">
          {history.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-muted-foreground">Nenhum recebimento encontrado.</p>
          ) : (
            <>
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
                      <span className={cn("num shrink-0 text-sm font-semibold text-positive", tx.is_ignored && "line-through opacity-60")}>
                        +{mask(formatBRL(tx.amount))}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              {allHistory.length > historyLimit ? (
                <div className="flex justify-center border-t py-3">
                  <Button size="sm" variant="outline" onClick={() => setHistoryLimit((n) => n + HISTORY_PAGE)}>
                    Mostrar mais ({allHistory.length - historyLimit} restantes)
                  </Button>
                </div>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <SourceDialog editing={editing} defaultMonth={selectedMonth} onClose={() => setEditing({ open: false })} />
      <ReceiveDialog row={receiving} today={today} onClose={() => setReceiving(null)} />

      <AlertDialog open={removing !== null} onOpenChange={(open) => !open && setRemoving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover “{removing?.title}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Os recebimentos já registrados continuam como entradas, apenas sem vínculo com esta fonte.
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
  const { source, status, receivedTotal, expectedDate, dueInMonth } = row;
  const badge = STATUS[status];
  const done = status === "received";
  const freq = source.frequency ?? "monthly";
  const scheduleLabel =
    freq === "annual"
      ? `anual em ${MONTH_OPTIONS[(source.pay_month ?? 12) - 1]?.label ?? "Dez"}`
      : freq === "once"
        ? `pontual em ${source.scheduled_month ? formatMonthLabel(source.scheduled_month) : "—"}`
        : "por mês";

  return (
    <li className={cn("grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center", !source.active && "opacity-60")}>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="truncate text-sm font-semibold">{source.title}</span>
          <Pill tone="blue">{INCOME_KIND_LABEL[source.kind]}</Pill>
          {freq !== "monthly" ? <Pill tone="violet">{freq === "annual" ? "Anual" : "Pontual"}</Pill> : null}
          {!source.active ? (
            <Pill>Pausada</Pill>
          ) : !dueInMonth && receivedTotal === 0 ? (
            <Pill tone="slate">Fora deste mês</Pill>
          ) : (
            <Pill tone={badge.tone}>{badge.label}</Pill>
          )}
        </div>
        <p className="num mt-1 text-xs text-muted-foreground">
          {formatBRL(source.expected_amount)} {scheduleLabel} • dia {source.pay_day}
          {dueInMonth ? ` (previsto ${formatDateBR(expectedDate)})` : ""}
          {receivedTotal > 0 ? ` • recebido ${formatBRL(receivedTotal)}` : ""}
        </p>
      </div>
      <div className="flex items-center gap-1">
        {source.active ? (
          <Button size="sm" variant={done || !dueInMonth ? "outline" : "default"} onClick={onReceive} className="mr-1 flex-1 sm:flex-none">
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

function SourceDialog({ editing, defaultMonth, onClose }: { editing: Editing; defaultMonth: string; onClose: () => void }) {
  return (
    <Dialog open={editing.open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {editing.open ? <SourceForm key={editing.source?.id ?? "new"} source={editing.source} defaultMonth={defaultMonth} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function SourceForm({ source, defaultMonth, onDone }: { source: IncomeSource | null; defaultMonth: string; onDone: () => void }) {
  const { commit } = useFinance();
  const [title, setTitle] = useState(source?.title ?? "");
  const [kind, setKind] = useState<IncomeKind>(source?.kind ?? "salary");
  const [frequency, setFrequency] = useState<IncomeFrequency>(source?.frequency ?? "monthly");
  const [payMonth, setPayMonth] = useState(String(source?.pay_month ?? 12));
  const [scheduledMonth, setScheduledMonth] = useState(source?.scheduled_month ?? defaultMonth);
  const [amount, setAmount] = useState(source ? amountInput(source.expected_amount) : "");
  const [payDay, setPayDay] = useState(String(source?.pay_day ?? 5));
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = parseAmount(amount);
    const parsedDay = Number(payDay);
    if (!title.trim()) return setError("Informe um nome.");
    if (parsedAmount === null || parsedAmount <= 0) return setError("Valor inválido.");
    if (!Number.isInteger(parsedDay) || parsedDay < 1 || parsedDay > 31) return setError("Dia entre 1 e 31.");
    if (frequency === "once" && !/^\d{4}-\d{2}$/.test(scheduledMonth)) return setError("Informe o mês previsto.");

    commit((current) =>
      upsertIncomeSource(current, {
        id: source?.id,
        title: title.trim(),
        kind,
        expected_amount: parsedAmount,
        pay_day: parsedDay,
        active: source?.active ?? true,
        frequency,
        pay_month: frequency === "annual" ? Number(payMonth) : null,
        scheduled_month: frequency === "once" ? scheduledMonth : null,
      }),
    );
    toast.success(source ? "Fonte atualizada" : "Fonte cadastrada");
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{source ? "Editar fonte de renda" : "Nova fonte de renda"}</DialogTitle>
        <DialogDescription>Cadastre salários mensais, 13º/PLR anuais ou entradas pontuais previstas.</DialogDescription>
      </DialogHeader>
      <div className="grid gap-1.5">
        <Label htmlFor="src-title">Nome</Label>
        <Input id="src-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Salário CLT, 13º Salário, Restituição IR" autoFocus />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label>Tipo</Label>
          <SimpleSelect value={kind} options={KIND_OPTIONS} onChange={setKind} className="w-full" />
        </div>
        <div className="grid gap-1.5">
          <Label>Periodicidade</Label>
          <SimpleSelect value={frequency} options={FREQUENCY_OPTIONS} onChange={setFrequency} className="w-full" />
        </div>
      </div>
      {frequency === "annual" ? (
        <div className="grid gap-1.5">
          <Label>Mês do recebimento anual</Label>
          <SimpleSelect value={payMonth} options={MONTH_OPTIONS} onChange={setPayMonth} className="w-full" />
        </div>
      ) : null}
      {frequency === "once" ? (
        <div className="grid gap-1.5">
          <Label htmlFor="src-sched">Mês previsto</Label>
          <Input id="src-sched" type="month" value={scheduledMonth} onChange={(event) => setScheduledMonth(event.target.value)} />
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="src-amount">Valor líquido (R$)</Label>
          <Input id="src-amount" inputMode="decimal" className="num" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="0,00" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="src-day">Dia do pagamento</Label>
          <Input id="src-day" type="number" min={1} max={31} className="num" value={payDay} onChange={(event) => setPayDay(event.target.value)} />
        </div>
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

function ReceiveDialog({ row, today, onClose }: { row: IncomeSourceMonth | null; today: IsoDate; onClose: () => void }) {
  return (
    <Dialog open={row !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        {row ? <ReceiveForm key={row.source.id} row={row} today={today} onDone={onClose} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function ReceiveForm({ row, today, onDone }: { row: IncomeSourceMonth; today: IsoDate; onDone: () => void }) {
  const { commit } = useFinance();
  const remaining = Math.max(0, row.source.expected_amount - row.receivedTotal);
  const [amount, setAmount] = useState(amountInput(remaining > 0 ? remaining : row.source.expected_amount));
  const [date, setDate] = useState(row.expectedDate <= today ? row.expectedDate : today);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const parsedAmount = parseAmount(amount);
    const iso = normalizeDate(date);
    if (parsedAmount === null || parsedAmount <= 0) return setError("Valor inválido.");
    if (!iso) return setError("Data inválida.");
    commit((current) => receiveIncome(current, row.source.id, { date: iso, amount: parsedAmount, notes }));
    toast.success("Recebimento registrado", { description: `${row.source.title} • ${formatBRL(parsedAmount)}` });
    onDone();
  }

  return (
    <form onSubmit={submit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>Registrar recebimento</DialogTitle>
        <DialogDescription>{row.source.title}</DialogDescription>
      </DialogHeader>
      <div className="grid grid-cols-2 gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="rec-amount">Valor recebido (R$)</Label>
          <Input id="rec-amount" inputMode="decimal" className="num" value={amount} onChange={(event) => setAmount(event.target.value)} autoFocus />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="rec-date">Data</Label>
          <Input id="rec-date" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </div>
      </div>
      <div className="grid gap-1.5">
        <Label htmlFor="rec-notes">Observações (opcional)</Label>
        <Input id="rec-notes" value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex.: bônus, desconto INSS..." />
      </div>
      {error ? <p className="text-xs text-rose-600">{error}</p> : null}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">Confirmar recebimento</Button>
      </DialogFooter>
    </form>
  );
}

function Stat({ label, value, hint, tone, className }: { label: string; value: string; hint?: string; tone?: "good" | "warn"; className?: string }) {
  return (
    <div className={cn("rounded-2xl border border-border/80 bg-card p-3.5 shadow-panel sm:rounded-xl sm:p-4", className)}>
      <p className="text-xs text-muted-foreground sm:text-sm">{label}</p>
      <p className={cn("num pt-1 text-lg font-bold tracking-tight sm:text-2xl sm:font-semibold", tone === "good" && "text-positive", tone === "warn" && "text-warning")}>{value}</p>
      {hint ? <p className="pt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
