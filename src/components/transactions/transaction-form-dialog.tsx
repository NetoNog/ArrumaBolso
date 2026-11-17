"use client";

import { Lock, ShieldCheck } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { CategorySelect } from "@/components/common/category-select";
import { SimpleSelect } from "@/components/common/simple-select";
import { SourceBadge } from "@/components/common/source-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateBR, formatMonthLabel, invoiceMonthForDate, normalizeDate } from "@/lib/dates";
import { createTransaction, splitInstallments, updateTransaction, type TransactionPatch } from "@/lib/domain/operations";
import {
  PAYMENT_METHOD_LABEL,
  TRANSACTION_TYPE_LABEL,
  type InvoiceMonth,
  type IsoDate,
  type PaymentMethod,
  type Transaction,
  type TransactionType,
} from "@/lib/domain/types";
import { formatBRL, parseAmount } from "@/lib/money";
import { useFinance } from "@/lib/store/finance-store";

type RecurrenceKind = "single" | "installments" | "subscription";

const TYPE_OPTIONS = (Object.keys(TRANSACTION_TYPE_LABEL) as TransactionType[]).map((value) => ({
  value,
  label: TRANSACTION_TYPE_LABEL[value],
}));
const METHOD_OPTIONS = (Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((value) => ({
  value,
  label: PAYMENT_METHOD_LABEL[value],
}));
const RECURRENCE_OPTIONS: { value: RecurrenceKind; label: string }[] = [
  { value: "single", label: "Única" },
  { value: "installments", label: "Parcelado em X vezes" },
  { value: "subscription", label: "Assinatura Mensal" },
];

export interface TransactionFormDefaults {
  date?: IsoDate;
  invoice_month?: InvoiceMonth;
}

function formatAmountInput(value: number): string {
  return Math.abs(value).toFixed(2).replace(".", ",");
}

export function TransactionFormDialog({
  open,
  onOpenChange,
  transaction,
  defaults,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transaction: Transaction | null;
  defaults?: TransactionFormDefaults;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        {open ? (
          <TransactionForm
            key={transaction?.id ?? "new"}
            transaction={transaction}
            defaults={defaults}
            onDone={() => onOpenChange(false)}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function TransactionForm({
  transaction,
  defaults,
  onDone,
}: {
  transaction: Transaction | null;
  defaults?: TransactionFormDefaults;
  onDone: () => void;
}) {
  const { state, commit, today } = useFinance();
  const isEdit = transaction !== null;

  const [type, setType] = useState<TransactionType>(transaction?.type ?? "expense");
  const [method, setMethod] = useState<PaymentMethod>(transaction?.payment_method ?? "pix_debit");
  const [date, setDate] = useState<IsoDate>(transaction?.date ?? defaults?.date ?? today);
  const [title, setTitle] = useState(transaction?.clean_title ?? "");
  const [amountText, setAmountText] = useState(transaction ? formatAmountInput(transaction.amount) : "");
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.category_id ?? null);
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [recurrence, setRecurrence] = useState<RecurrenceKind>("single");
  const [installments, setInstallments] = useState("2");
  const [invoiceMonth, setInvoiceMonth] = useState<InvoiceMonth>(
    transaction?.invoice_month ?? defaults?.invoice_month ?? invoiceMonthForDate(today, state.settings.closing_day),
  );
  const [monthTouched, setMonthTouched] = useState(isEdit || Boolean(defaults?.invoice_month));
  const [errors, setErrors] = useState<Record<string, string>>({});

  const amount = parseAmount(amountText);
  const installmentCount = Number(installments);
  const preview =
    !isEdit && recurrence === "installments" && amount && amount > 0 && installmentCount >= 2
      ? splitInstallments(amount, installmentCount)
      : null;

  function handleDateChange(value: string) {
    setDate(value);
    const normalized = normalizeDate(value);
    if (normalized && !monthTouched) setInvoiceMonth(invoiceMonthForDate(normalized, state.settings.closing_day));
  }

  function validate(): Record<string, string> {
    const next: Record<string, string> = {};
    if (!title.trim()) next.title = "Informe um título.";
    if (amount === null || amount <= 0) next.amount = "Informe um valor maior que zero.";
    if (!normalizeDate(date)) next.date = "Data inválida.";
    if (!/^\d{4}-\d{2}$/.test(invoiceMonth)) next.invoiceMonth = "Competência inválida.";
    if (!isEdit && recurrence === "installments" && (!Number.isInteger(installmentCount) || installmentCount < 2 || installmentCount > 48)) {
      next.installments = "Entre 2 e 48 parcelas.";
    }
    return next;
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || amount === null) return;
    const isoDate = normalizeDate(date) as IsoDate;

    if (transaction) {
      const patch: TransactionPatch = {
        clean_title: title.trim(),
        amount: type === "payment" ? -amount : amount,
        date: isoDate,
        invoice_month: invoiceMonth,
        category_id: type === "payment" ? null : categoryId,
        notes: notes.trim(),
        type,
        payment_method: method,
      };
      const changed = (Object.keys(patch) as (keyof TransactionPatch)[]).some((key) => patch[key] !== transaction[key]);
      if (!changed) {
        onDone();
        return;
      }
      commit((current) => updateTransaction(current, transaction.id, patch));
      toast.success("Lançamento atualizado", {
        description: transaction.source === "csv" ? "Marcado como editado: futuras importações não vão sobrescrevê-lo." : undefined,
      });
    } else {
      commit((current) =>
        createTransaction(current, {
          type,
          payment_method: method,
          date: isoDate,
          title,
          amount,
          category_id: categoryId,
          notes,
          invoice_month: invoiceMonth,
          recurrence:
            recurrence === "installments"
              ? { kind: "installments", count: installmentCount }
              : recurrence === "subscription"
                ? { kind: "subscription" }
                : { kind: "single" },
        }),
      );
      toast.success(
        recurrence === "installments" ? `${installmentCount} parcelas criadas` : "Lançamento criado",
        { description: `${title.trim()} • ${formatBRL(amount)}` },
      );
    }
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar Lançamento" : "Novo Gasto"}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Alterações manuais são soberanas: o lançamento fica protegido contra reimportações do CSV."
            : "Registre despesas fora do cartão, receitas, boletos ou compras futuras."}
        </DialogDescription>
      </DialogHeader>

      {transaction ? (
        <div className="grid gap-1.5 rounded-lg border bg-muted/40 p-3 text-xs">
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Origem</span>
            <SourceBadge tx={transaction} />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-muted-foreground">Título original</span>
            <span className="num truncate text-right">{transaction.raw_title}</span>
          </div>
          {transaction.installment_total ? (
            <div className="flex items-center justify-between gap-2">
              <span className="text-muted-foreground">Parcela</span>
              <span className="num">
                {transaction.installment_current}/{transaction.installment_total}
              </span>
            </div>
          ) : null}
          {transaction.source === "csv" && !transaction.is_user_edited ? (
            <p className="flex items-center gap-1.5 pt-1 text-muted-foreground">
              <ShieldCheck className="size-3.5 text-emerald-600" />
              Ao salvar, este item vira <strong className="font-medium text-foreground">Editado</strong> e fica protegido.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-2 gap-3">
        <Field label="Tipo" htmlFor="tx-type">
          <SimpleSelect id="tx-type" value={type} options={TYPE_OPTIONS} onChange={setType} className="w-full" />
        </Field>
        <Field label="Método" htmlFor="tx-method">
          <SimpleSelect id="tx-method" value={method} options={METHOD_OPTIONS} onChange={setMethod} className="w-full" />
        </Field>
      </div>

      <Field label="Título / Descrição" htmlFor="tx-title" error={errors.title}>
        <Input id="tx-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Mercado do mês" autoFocus={!isEdit} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field
          label={!isEdit && recurrence === "installments" ? "Valor total (R$)" : "Valor (R$)"}
          htmlFor="tx-amount"
          error={errors.amount}
        >
          <Input
            id="tx-amount"
            inputMode="decimal"
            className="num"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="0,00"
          />
        </Field>
        <Field label="Data" htmlFor="tx-date" error={errors.date}>
          <Input id="tx-date" type="date" value={date} onChange={(event) => handleDateChange(event.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria" htmlFor="tx-category">
          <CategorySelect categories={state.categories} value={categoryId} onChange={setCategoryId} className="w-full" disabled={type === "payment"} />
        </Field>
        <Field
          label="Competência (fatura)"
          htmlFor="tx-month"
          error={errors.invoiceMonth}
          hint={transaction?.locked_fields.includes("invoice_month") ? "Ajustada manualmente" : undefined}
        >
          <Input
            id="tx-month"
            type="month"
            value={invoiceMonth}
            onChange={(event) => {
              setMonthTouched(true);
              setInvoiceMonth(event.target.value);
            }}
          />
        </Field>
      </div>

      {!isEdit ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Recorrência" htmlFor="tx-recurrence">
            <SimpleSelect id="tx-recurrence" value={recurrence} options={RECURRENCE_OPTIONS} onChange={setRecurrence} className="w-full" />
          </Field>
          {recurrence === "installments" ? (
            <Field label="Nº de parcelas" htmlFor="tx-installments" error={errors.installments}>
              <Input
                id="tx-installments"
                type="number"
                min={2}
                max={48}
                className="num"
                value={installments}
                onChange={(event) => setInstallments(event.target.value)}
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      {preview ? (
        <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
          {installmentCount}x de <span className="num font-medium">{formatBRL(preview[preview.length - 1])}</span>
          {preview[0] !== preview[preview.length - 1] ? (
            <>
              {" "}(1ª parcela <span className="num">{formatBRL(preview[0])}</span>)
            </>
          ) : null}{" "}
          de {formatMonthLabel(invoiceMonth)} até a competência final, iniciando em {formatDateBR(normalizeDate(date) ?? today)}.
        </p>
      ) : null}

      <Field label="Observações" htmlFor="tx-notes">
        <Textarea id="tx-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Opcional" />
      </Field>

      {transaction && transaction.locked_fields.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" /> {transaction.locked_fields.length} campo(s) já protegido(s) por edição manual.
        </p>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancelar
        </Button>
        <Button type="submit">{isEdit ? "Salvar alterações" : "Criar lançamento"}</Button>
      </DialogFooter>
    </form>
  );
}

function Field({
  label,
  htmlFor,
  error,
  hint,
  children,
}: {
  label: string;
  htmlFor: string;
  error?: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium text-muted-foreground">
        {label}
      </Label>
      {children}
      {error ? <p className="text-xs text-rose-600">{error}</p> : hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}
