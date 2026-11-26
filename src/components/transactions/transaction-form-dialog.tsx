"use client";

import { ExternalLink, FileText, Lock, Paperclip, Plus, Scissors, ShieldCheck, Trash2, Upload } from "lucide-react";
import { useMemo, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";
import { cn } from "cn";

import { CategoryIcon } from "@/components/common/category-icon";
import { CategorySelect } from "@/components/common/category-select";
import { SimpleSelect } from "@/components/common/simple-select";
import { SourceBadge } from "@/components/common/source-badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatDateBR, formatMonthLabel, invoiceMonthForDate, normalizeDate } from "@/lib/dates";
import {
  activeCards,
  closingDayForCard,
  createTransaction,
  defaultCardId,
  parseTagInput,
  splitInstallments,
  splitTransaction,
  updateTransaction,
  type TransactionPatch,
} from "@/lib/domain/operations";
import {
  PAYMENT_METHOD_LABEL,
  PET_EXPENSE_KIND_LABEL,
  TRANSACTION_TYPE_LABEL,
  type InvoiceMonth,
  type IsoDate,
  type PaymentMethod,
  type PetExpenseKind,
  type Transaction,
  type TransactionLineItem,
  type TransactionType,
} from "@/lib/domain/types";
import { formatBRL, parseAmount, sumMoney } from "@/lib/money";
import { cardLabel } from "@/lib/import/issuers";
import { useFinance } from "@/lib/store/finance-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

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
  type?: TransactionType;
  category_id?: string | null;
  pet_id?: string | null;
  pet_expense_kind?: PetExpenseKind | null;
}

const NO_SOURCE = "__none__";
const NO_CARD = "__no_card__";
const NO_ACCOUNT = "__no_account__";
const NO_PET = "__no_pet__";
const NO_PET_KIND = "__auto__";
const NO_REFUND = "__no_refund__";

const PET_KIND_OPTIONS: { value: string; label: string }[] = [
  { value: NO_PET_KIND, label: "Detectar automaticamente" },
  ...(Object.keys(PET_EXPENSE_KIND_LABEL) as PetExpenseKind[]).map((value) => ({
    value,
    label: PET_EXPENSE_KIND_LABEL[value],
  })),
];

interface LineItemDraft {
  key: string;
  name: string;
  qtyText: string;
  unitPriceText: string;
}

const CREATE_TITLE: Record<TransactionType, string> = {
  expense: "Nova Saída",
  income: "Nova Entrada",
  payment: "Pagamento de Fatura",
};

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
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
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

interface SplitRowDraft {
  key: string;
  categoryId: string | null;
  amountText: string;
  title: string;
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

  const [type, setType] = useState<TransactionType>(transaction?.type ?? defaults?.type ?? "expense");
  const [incomeSourceId, setIncomeSourceId] = useState<string>(transaction?.income_source_id ?? NO_SOURCE);
  const [refundOfId, setRefundOfId] = useState<string>(transaction?.refund_of_transaction_id ?? NO_REFUND);
  const activeSources = state.income_sources.filter((source) => source.active);
  const sourceOptions = [
    { value: NO_SOURCE, label: "Nenhuma (entrada avulsa)" },
    ...activeSources.map((source) => ({ value: source.id, label: source.title })),
  ];
  const [method, setMethod] = useState<PaymentMethod>(transaction?.payment_method ?? "pix_debit");
  const availableCards = activeCards(state).concat(
    transaction?.card_id
      ? state.cards.filter((c) => c.id === transaction.card_id && c.is_archived)
      : [],
  );
  const [cardId, setCardId] = useState<string>(transaction?.card_id ?? defaultCardId(state) ?? NO_CARD);
  const cardOptions = [
    { value: NO_CARD, label: "Sem cartão vinculado" },
    ...availableCards.map((card) => ({
      value: card.id,
      label: card.parent_card_id ? `↳ ${cardLabel(card)}` : cardLabel(card),
    })),
  ];
  const selectedCardId = method === "credit_card" && cardId !== NO_CARD ? cardId : null;
  const availableAccounts = (state.accounts ?? []).filter(
    (acc) => !acc.is_archived || acc.id === transaction?.account_id,
  );
  const [accountId, setAccountId] = useState<string>(transaction?.account_id ?? NO_ACCOUNT);
  const accountOptions = [
    { value: NO_ACCOUNT, label: "Sem conta vinculada" },
    ...availableAccounts.map((acc) => ({ value: acc.id, label: acc.name })),
  ];
  const selectedAccountId = (method !== "credit_card" || type !== "expense") && accountId !== NO_ACCOUNT ? accountId : null;
  const [receiptPath, setReceiptPath] = useState<string | null>(transaction?.receipt_path ?? null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const receiptInputRef = useRef<HTMLInputElement | null>(null);
  const [lineItems, setLineItems] = useState<LineItemDraft[]>(() =>
    (transaction?.line_items ?? []).map((item, idx) => ({
      key: `li-${idx}`,
      name: item.name,
      qtyText: String(item.qty),
      unitPriceText: formatAmountInput(item.unit_price),
    })),
  );
  const [date, setDate] = useState<IsoDate>(transaction?.date ?? defaults?.date ?? today);
  const [title, setTitle] = useState(transaction?.clean_title ?? "");
  const [amountText, setAmountText] = useState(transaction ? formatAmountInput(transaction.amount) : "");
  const [categoryId, setCategoryId] = useState<string | null>(transaction?.category_id ?? defaults?.category_id ?? null);
  const availablePets = (state.pets ?? []).filter((pet) => !pet.is_archived || pet.id === transaction?.pet_id || pet.id === defaults?.pet_id);
  const [petId, setPetId] = useState<string>(transaction?.pet_id ?? defaults?.pet_id ?? NO_PET);
  const [petExpenseKind, setPetExpenseKind] = useState<string>(
    transaction?.pet_expense_kind ?? defaults?.pet_expense_kind ?? NO_PET_KIND,
  );
  const petOptions = [
    { value: NO_PET, label: "Não vincular a um pet" },
    ...availablePets.map((pet) => ({ value: pet.id, label: `🐾 ${pet.name}` })),
  ];
  const selectedPetId = type === "expense" && petId !== NO_PET ? petId : null;
  const selectedPetKind: PetExpenseKind | null =
    selectedPetId && petExpenseKind !== NO_PET_KIND ? (petExpenseKind as PetExpenseKind) : null;
  const [notes, setNotes] = useState(transaction?.notes ?? "");
  const [tagsText, setTagsText] = useState((transaction?.tags ?? []).map((t) => `#${t}`).join(" "));
  const [origCurrency, setOrigCurrency] = useState(transaction?.original_currency ?? "");
  const [origAmountText, setOrigAmountText] = useState(
    transaction?.original_amount ? formatAmountInput(transaction.original_amount) : "",
  );
  const [iofText, setIofText] = useState(transaction?.iof_amount ? formatAmountInput(transaction.iof_amount) : "");
  const [recurrence, setRecurrence] = useState<RecurrenceKind>("single");
  const [installments, setInstallments] = useState("2");
  const [invoiceMonth, setInvoiceMonth] = useState<InvoiceMonth>(
    transaction?.invoice_month ?? defaults?.invoice_month ?? invoiceMonthForDate(today, closingDayForCard(state, selectedCardId)),
  );
  const [monthTouched, setMonthTouched] = useState(isEdit || Boolean(defaults?.invoice_month));
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Split mode (only when editing an expense)
  const [splitMode, setSplitMode] = useState(false);
  const [splitRows, setSplitRows] = useState<SplitRowDraft[]>(() => {
    if (!transaction) return [];
    const half = Math.round((Math.abs(transaction.amount) / 2) * 100) / 100;
    const rest = Math.max(0.01, sumMoney([Math.abs(transaction.amount), -half]));
    return [
      { key: "p1", categoryId: transaction.category_id, amountText: formatAmountInput(half), title: `${transaction.clean_title} (parte 1)` },
      { key: "p2", categoryId: null, amountText: formatAmountInput(rest), title: `${transaction.clean_title} (parte 2)` },
    ];
  });

  // Candidate expenses that an income entry can offset as a reimbursement/refund.
  const refundOptions = useMemo(() => {
    const expenses = state.transactions
      .filter((tx) => tx.type === "expense" && !tx.is_ignored && tx.id !== transaction?.id)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 60);
    return [
      { value: NO_REFUND, label: "Não é reembolso (entrada normal)" },
      ...expenses.map((tx) => ({
        value: tx.id,
        label: `${tx.clean_title} • ${formatBRL(tx.amount)} (${formatDateBR(tx.date)})`,
      })),
    ];
  }, [state.transactions, transaction?.id]);

  const parsedTags = parseTagInput(tagsText);
  const amount = parseAmount(amountText);
  const installmentCount = Number(installments);
  const parsedLineItems: TransactionLineItem[] = lineItems
    .map((row) => {
      const name = row.name.trim();
      const qty = Number(row.qtyText.replace(",", ".")) || 0;
      const unitPrice = parseAmount(row.unitPriceText) ?? 0;
      return { name, qty: qty > 0 ? qty : 1, unit_price: Math.max(0, unitPrice) };
    })
    .filter((item) => item.name.length > 0 && item.unit_price > 0);
  const lineItemsTotal = sumMoney(parsedLineItems.map((item) => item.qty * item.unit_price));

  async function handleReceiptUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande (máximo 10 MB).");
      return;
    }
    const client = getSupabaseBrowserClient();
    if (!client) {
      toast.error("Armazenamento de comprovantes disponível apenas com conta conectada.");
      return;
    }
    setUploadingReceipt(true);
    try {
      const { data: userData } = await client.auth.getUser();
      const userId = userData.user?.id;
      if (!userId) {
        toast.error("Faça login para enviar comprovantes.");
        return;
      }
      const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
      const prefix = transaction?.id ?? "draft";
      const path = `${userId}/${prefix}-${Date.now()}.${ext}`;
      const { error } = await client.storage.from("receipts").upload(path, file, { upsert: false });
      if (error) {
        toast.error("Falha ao enviar comprovante", { description: error.message });
        return;
      }
      if (receiptPath && receiptPath !== path) {
        await client.storage.from("receipts").remove([receiptPath]);
      }
      setReceiptPath(path);
      toast.success("Comprovante anexado!");
    } finally {
      setUploadingReceipt(false);
    }
  }

  async function handleOpenReceipt() {
    if (!receiptPath) return;
    const client = getSupabaseBrowserClient();
    if (!client) return;
    const { data, error } = await client.storage.from("receipts").createSignedUrl(receiptPath, 300);
    if (error || !data?.signedUrl) {
      toast.error("Não foi possível abrir o comprovante", { description: error?.message });
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function handleRemoveReceipt() {
    if (!receiptPath) return;
    const client = getSupabaseBrowserClient();
    if (client) {
      await client.storage.from("receipts").remove([receiptPath]);
    }
    setReceiptPath(null);
    toast.success("Comprovante removido");
  }
  const preview =
    !isEdit && recurrence === "installments" && amount && amount > 0 && installmentCount >= 2
      ? splitInstallments(amount, installmentCount)
      : null;

  function handleDateChange(value: string) {
    setDate(value);
    const normalized = normalizeDate(value);
    if (normalized && !monthTouched) {
      setInvoiceMonth(invoiceMonthForDate(normalized, closingDayForCard(state, selectedCardId)));
    }
  }

  function handleCardChange(nextCardId: string) {
    setCardId(nextCardId);
    const normalized = normalizeDate(date);
    if (normalized && !monthTouched) {
      setInvoiceMonth(invoiceMonthForDate(normalized, closingDayForCard(state, nextCardId === NO_CARD ? null : nextCardId)));
    }
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

  function confirmSplit() {
    if (!transaction) return;
    const parsedParts = splitRows.map((row) => ({
      category_id: row.categoryId,
      amount: parseAmount(row.amountText) ?? 0,
      clean_title: row.title.trim() || transaction.clean_title,
    }));
    if (parsedParts.length < 2 || parsedParts.some((part) => part.amount <= 0)) {
      toast.error("Informe valores positivos para cada parte");
      return;
    }
    const totalParts = sumMoney(parsedParts.map((part) => part.amount));
    const originalTotal = Math.abs(transaction.amount);
    if (Math.abs(totalParts - originalTotal) > 0.01) {
      toast.error("A soma das partes precisa fechar com o valor original", {
        description: `Soma atual: ${formatBRL(totalParts)} vs. original ${formatBRL(originalTotal)}.`,
      });
      return;
    }
    commit((current) => splitTransaction(current, transaction.id, parsedParts));
    toast.success(`Lançamento dividido em ${parsedParts.length} partes`);
    onDone();
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0 || amount === null) return;
    const isoDate = normalizeDate(date) as IsoDate;
    const linkedRefund = type === "income" && refundOfId !== NO_REFUND ? refundOfId : null;
    const parsedOrigCurr = origCurrency.trim().toUpperCase();
    const validOrigCurr = /^[A-Z]{3}$/.test(parsedOrigCurr) ? parsedOrigCurr : null;
    const parsedOrigAmt = origAmountText.trim() ? parseAmount(origAmountText) : null;
    const parsedIof = iofText.trim() ? parseAmount(iofText) : null;

    if (transaction) {
      const patch: TransactionPatch = {
        clean_title: title.trim(),
        amount: type === "payment" ? -amount : amount,
        date: isoDate,
        invoice_month: invoiceMonth,
        category_id: type === "payment" ? null : categoryId,
        notes: notes.trim(),
        tags: parsedTags,
        type,
        payment_method: method,
        card_id: selectedCardId,
        account_id: selectedAccountId,
        refund_of_transaction_id: linkedRefund,
        original_currency: validOrigCurr,
        original_amount: parsedOrigAmt && parsedOrigAmt > 0 ? parsedOrigAmt : null,
        iof_amount: parsedIof !== null && parsedIof >= 0 ? parsedIof : null,
        receipt_path: receiptPath,
        line_items: parsedLineItems,
        pet_id: selectedPetId,
        pet_expense_kind: selectedPetId ? selectedPetKind : null,
      };
      commit((current) => updateTransaction(current, transaction.id, patch));
      toast.success("Lançamento atualizado", {
        description: transaction.source === "csv" ? "Marcado como editado: futuras importações não vão sobrescrevê-lo." : undefined,
      });
    } else {
      commit((current) =>
        createTransaction(current, {
          type,
          payment_method: method,
          card_id: selectedCardId,
          account_id: selectedAccountId,
          date: isoDate,
          title,
          amount,
          category_id: categoryId,
          notes,
          tags: parsedTags,
          invoice_month: invoiceMonth,
          income_source_id: incomeSourceId === NO_SOURCE ? null : incomeSourceId,
          refund_of_transaction_id: linkedRefund,
          original_currency: validOrigCurr,
          original_amount: parsedOrigAmt && parsedOrigAmt > 0 ? parsedOrigAmt : null,
          iof_amount: parsedIof !== null && parsedIof >= 0 ? parsedIof : null,
          receipt_path: receiptPath,
          line_items: parsedLineItems,
          pet_id: selectedPetId,
          pet_expense_kind: selectedPetKind,
          recurrence:
            recurrence === "installments"
              ? { kind: "installments", count: installmentCount }
              : recurrence === "subscription"
                ? { kind: "subscription" }
                : { kind: "single" },
        }),
      );
      toast.success(
        recurrence === "installments" ? `${installmentCount} parcelas criadas` : linkedRefund ? "Reembolso vinculado criado" : "Lançamento criado",
        { description: `${title.trim()} • ${formatBRL(amount)}` },
      );
    }
    onDone();
  }

  if (splitMode && transaction) {
    const originalTotal = Math.abs(transaction.amount);
    const currentSum = sumMoney(splitRows.map((row) => parseAmount(row.amountText) ?? 0));
    const remaining = sumMoney([originalTotal, -currentSum]);

    return (
      <div className="grid gap-4">
        <DialogHeader>
          <DialogTitle>Dividir lançamento</DialogTitle>
          <DialogDescription>
            Divida <strong className="font-medium text-foreground">{transaction.clean_title}</strong> ({formatBRL(originalTotal)}) entre
            múltiplas categorias. O hash original é mantido para evitar duplicidades.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          {splitRows.map((row, index) => (
            <div key={row.key} className="grid gap-2 rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-medium text-muted-foreground">Parte {index + 1}</span>
                {splitRows.length > 2 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    onClick={() => setSplitRows((current) => current.filter((item) => item.key !== row.key))}
                  >
                    <Trash2 />
                  </Button>
                ) : null}
              </div>
              <Input
                value={row.title}
                onChange={(event) =>
                  setSplitRows((current) =>
                    current.map((item) => (item.key === row.key ? { ...item, title: event.target.value } : item)),
                  )
                }
                placeholder="Descrição da parte"
              />
              <div className="grid grid-cols-[1fr_8rem] gap-2">
                <CategorySelect
                  categories={state.categories}
                  value={row.categoryId}
                  onChange={(id) =>
                    setSplitRows((current) =>
                      current.map((item) => (item.key === row.key ? { ...item, categoryId: id } : item)),
                    )
                  }
                  className="w-full"
                />
                <Input
                  inputMode="decimal"
                  className="num"
                  value={row.amountText}
                  onChange={(event) =>
                    setSplitRows((current) =>
                      current.map((item) => (item.key === row.key ? { ...item, amountText: event.target.value } : item)),
                    )
                  }
                  placeholder="0,00"
                />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              setSplitRows((current) => [
                ...current,
                {
                  key: `p${Date.now()}`,
                  categoryId: null,
                  amountText: remaining > 0 ? formatAmountInput(remaining) : "",
                  title: `${transaction.clean_title} (parte ${current.length + 1})`,
                },
              ])
            }
          >
            <Plus /> Adicionar parte
          </Button>
          <span className={Math.abs(remaining) <= 0.01 ? "num font-medium text-emerald-600" : "num font-medium text-amber-600"}>
            {Math.abs(remaining) <= 0.01 ? "Soma exata!" : `Diferença: ${formatBRL(remaining)}`}
          </span>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setSplitMode(false)}>
            Voltar
          </Button>
          <Button type="button" onClick={confirmSplit}>
            <Scissors /> Confirmar divisão
          </Button>
        </DialogFooter>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4" noValidate>
      <DialogHeader>
        <DialogTitle>{isEdit ? "Editar Lançamento" : CREATE_TITLE[type]}</DialogTitle>
        <DialogDescription>
          {isEdit
            ? "Alterações manuais são soberanas: o lançamento fica protegido contra reimportações."
            : "Registre despesas, receitas, reembolsos vinculados, boletos ou compras parceladas."}
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

      {/* Bank-style hero amount input */}
      <div className="grid gap-1 rounded-2xl border border-border/70 bg-muted/35 px-4 py-3 text-center">
        <Label htmlFor="tx-amount" className="justify-center text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
          {!isEdit && recurrence === "installments" ? "Valor total da compra" : type === "income" ? "Valor da entrada" : "Valor"}
        </Label>
        <div className="flex items-baseline justify-center gap-1.5">
          <span className={cn("text-xl font-semibold", type === "income" ? "text-emerald-600" : "text-muted-foreground")}>R$</span>
          <input
            id="tx-amount"
            inputMode="decimal"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            placeholder="0,00"
            autoFocus={!isEdit}
            className={cn(
              "num w-44 bg-transparent text-center text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground/40",
              type === "income" ? "text-emerald-600" : "text-foreground",
            )}
          />
        </div>
        {errors.amount ? <p className="text-xs text-rose-600">{errors.amount}</p> : null}
      </div>

      {/* 1-tap quick category chips for fast mobile logging */}
      {type === "expense" && state.categories.length > 0 ? (
        <div className="-mx-1 flex items-center gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {state.categories.slice(0, 14).map((cat) => {
            const active = categoryId === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => setCategoryId(active ? null : cat.id)}
                className={cn(
                  "inline-flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                  active
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-border/70 bg-card text-muted-foreground hover:bg-muted",
                )}
              >
                <CategoryIcon icon={cat.icon} color={cat.color} className="inline-flex size-4 items-center justify-center rounded-full" />
                <span>{cat.name}</span>
              </button>
            );
          })}
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

      {method === "credit_card" && state.cards.length > 0 ? (
        <Field label="Cartão" htmlFor="tx-card">
          <SimpleSelect id="tx-card" value={cardId} options={cardOptions} onChange={handleCardChange} className="w-full" />
        </Field>
      ) : null}

      {(method !== "credit_card" || type !== "expense") && availableAccounts.length > 0 ? (
        <Field label="Conta / Carteira" htmlFor="tx-account">
          <SimpleSelect id="tx-account" value={accountId} options={accountOptions} onChange={setAccountId} className="w-full" />
        </Field>
      ) : null}

      {type === "income" ? (
        <div className="grid gap-3">
          <Field
            label="Reembolso de despesa (opcional)"
            htmlFor="tx-refund"
            hint="Se vincular a uma despesa, este valor abate o gasto da categoria em vez de somar como renda."
          >
            <SimpleSelect
              id="tx-refund"
              value={refundOfId}
              options={refundOptions}
              onChange={(value) => {
                setRefundOfId(value);
                if (value !== NO_REFUND) {
                  setIncomeSourceId(NO_SOURCE);
                  const target = state.transactions.find((item) => item.id === value);
                  if (target && !title.trim()) setTitle(`Reembolso: ${target.clean_title}`);
                }
              }}
              className="w-full"
            />
          </Field>
          {!isEdit && refundOfId === NO_REFUND && activeSources.length > 0 ? (
            <Field label="Fonte de renda" htmlFor="tx-income-source">
              <SimpleSelect
                id="tx-income-source"
                value={incomeSourceId}
                options={sourceOptions}
                onChange={(value) => {
                  setIncomeSourceId(value);
                  const source = activeSources.find((item) => item.id === value);
                  if (!source) return;
                  if (!title.trim()) setTitle(source.title);
                  if (!amountText.trim()) setAmountText(formatAmountInput(source.expected_amount));
                }}
                className="w-full"
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_10rem]">
        <Field label="Título / Descrição" htmlFor="tx-title" error={errors.title}>
          <Input id="tx-title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ex.: Mercado do mês" />
        </Field>
        <Field label="Data" htmlFor="tx-date" error={errors.date}>
          <Input id="tx-date" type="date" value={date} onChange={(event) => handleDateChange(event.target.value)} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="Categoria" htmlFor="tx-category">
          <CategorySelect
            categories={state.categories}
            value={categoryId}
            onChange={setCategoryId}
            className="w-full"
            disabled={type === "payment" || (type === "income" && refundOfId !== NO_REFUND)}
          />
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

      {type === "expense" && availablePets.length > 0 ? (
        <div className="grid grid-cols-2 gap-3">
          <Field label="Meu Pet (opcional)" htmlFor="tx-pet">
            <SimpleSelect id="tx-pet" value={petId} options={petOptions} onChange={setPetId} className="w-full" />
          </Field>
          {petId !== NO_PET ? (
            <Field label="Tipo de gasto pet" htmlFor="tx-pet-kind">
              <SimpleSelect
                id="tx-pet-kind"
                value={petExpenseKind}
                options={PET_KIND_OPTIONS}
                onChange={setPetExpenseKind}
                className="w-full"
              />
            </Field>
          ) : null}
        </div>
      ) : null}

      <Field label="Tags (opcional)" htmlFor="tx-tags" hint="Separe por espaço ou vírgula: #viagem #reembolsavel #irpf">
        <Input
          id="tx-tags"
          value={tagsText}
          onChange={(event) => setTagsText(event.target.value)}
          placeholder="ex.: #viagem-rio #reembolsavel"
        />
        {parsedTags.length > 0 ? (
          <div className="flex flex-wrap gap-1 pt-0.5">
            {parsedTags.map((tag) => (
              <span key={tag} className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-foreground">
                #{tag}
              </span>
            ))}
          </div>
        ) : null}
      </Field>

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
                inputMode="numeric"
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

      {type === "expense" && method === "credit_card" ? (
        <details className="rounded-lg border bg-muted/20 px-3 py-2 text-xs" open={Boolean(origCurrency || origAmountText || iofText)}>
          <summary className="cursor-pointer font-medium text-muted-foreground">
            Compra internacional (moeda estrangeira e IOF — opcional)
          </summary>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <Field label="Moeda (ISO)" htmlFor="tx-orig-curr">
              <Input
                id="tx-orig-curr"
                maxLength={3}
                placeholder="USD"
                value={origCurrency}
                onChange={(event) => setOrigCurrency(event.target.value.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 3))}
              />
            </Field>
            <Field label="Valor original" htmlFor="tx-orig-amt">
              <Input
                id="tx-orig-amt"
                inputMode="decimal"
                className="num"
                placeholder="49,90"
                value={origAmountText}
                onChange={(event) => setOrigAmountText(event.target.value)}
              />
            </Field>
            <Field label="IOF (R$)" htmlFor="tx-iof">
              <Input
                id="tx-iof"
                inputMode="decimal"
                className="num"
                placeholder="12,50"
                value={iofText}
                onChange={(event) => setIofText(event.target.value)}
              />
            </Field>
          </div>
        </details>
      ) : null}

      {/* Comprovante / Nota Fiscal */}
      <div className="grid gap-1.5 rounded-lg border bg-muted/20 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Paperclip className="size-3.5" /> Comprovante / Nota Fiscal (opcional)
          </span>
          <input
            ref={receiptInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
            className="hidden"
            onChange={handleReceiptUpload}
          />
          {receiptPath ? (
            <div className="flex items-center gap-1.5">
              <Button type="button" size="sm" variant="outline" className="h-7 text-xs" onClick={handleOpenReceipt}>
                <ExternalLink className="size-3" /> Abrir
              </Button>
              <Button type="button" size="sm" variant="ghost" className="h-7 text-xs text-rose-600" onClick={handleRemoveReceipt}>
                <Trash2 className="size-3" /> Remover
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              disabled={uploadingReceipt}
              onClick={() => receiptInputRef.current?.click()}
            >
              <Upload className="size-3" /> {uploadingReceipt ? "Enviando…" : "Anexar arquivo"}
            </Button>
          )}
        </div>
        {receiptPath ? (
          <p className="flex items-center gap-1.5 truncate text-xs text-emerald-700 dark:text-emerald-400">
            <FileText className="size-3.5 shrink-0" />
            <span className="truncate">{receiptPath.split("/").pop()}</span>
          </p>
        ) : (
          <p className="text-[11px] text-muted-foreground">JPG, PNG, WebP ou PDF até 10 MB (armazenado de forma privada).</p>
        )}
      </div>

      {/* Itens da compra (line_items) */}
      <details className="rounded-lg border bg-muted/20 px-3 py-2 text-xs" open={lineItems.length > 0}>
        <summary className="cursor-pointer font-medium text-muted-foreground">
          Itens da compra ({parsedLineItems.length}) — pesquisáveis no app
        </summary>
        <div className="mt-3 grid gap-2">
          {lineItems.map((row) => (
            <div key={row.key} className="grid grid-cols-[1fr_3.5rem_5.5rem_auto] items-center gap-1.5">
              <Input
                value={row.name}
                onChange={(event) =>
                  setLineItems((cur) => cur.map((r) => (r.key === row.key ? { ...r, name: event.target.value } : r)))
                }
                placeholder="Ex.: Café 500g"
                className="h-8 text-xs"
                aria-label="Nome do item"
              />
              <Input
                value={row.qtyText}
                onChange={(event) =>
                  setLineItems((cur) => cur.map((r) => (r.key === row.key ? { ...r, qtyText: event.target.value } : r)))
                }
                inputMode="decimal"
                placeholder="Qtd"
                className="num h-8 text-xs"
                aria-label="Quantidade"
              />
              <Input
                value={row.unitPriceText}
                onChange={(event) =>
                  setLineItems((cur) => cur.map((r) => (r.key === row.key ? { ...r, unitPriceText: event.target.value } : r)))
                }
                inputMode="decimal"
                placeholder="R$ un."
                className="num h-8 text-xs"
                aria-label="Preço unitário"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remover item"
                onClick={() => setLineItems((cur) => cur.filter((r) => r.key !== row.key))}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          ))}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() =>
                setLineItems((cur) => [...cur, { key: `li-${Date.now()}-${cur.length}`, name: "", qtyText: "1", unitPriceText: "" }])
              }
            >
              <Plus className="size-3" /> Adicionar item
            </Button>
            {lineItemsTotal > 0 ? (
              <div className="flex items-center gap-2">
                <span className="num text-muted-foreground">Soma: {formatBRL(lineItemsTotal)}</span>
                {(!amount || Math.abs(amount - lineItemsTotal) > 0.01) ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2 text-[11px] text-blue-600"
                    onClick={() => setAmountText(formatAmountInput(lineItemsTotal))}
                  >
                    Usar soma como valor
                  </Button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </details>

      <Field label="Observações" htmlFor="tx-notes">
        <Textarea id="tx-notes" value={notes} onChange={(event) => setNotes(event.target.value)} rows={2} placeholder="Opcional" />
      </Field>

      {transaction && transaction.locked_fields.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Lock className="size-3" /> {transaction.locked_fields.length} campo(s) já protegido(s) por edição manual.
        </p>
      ) : null}

      <DialogFooter className="flex-wrap gap-2">
        {isEdit && transaction.type === "expense" && !transaction.installment_total ? (
          <Button type="button" variant="outline" className="mr-auto" onClick={() => setSplitMode(true)}>
            <Scissors /> Dividir
          </Button>
        ) : null}
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
