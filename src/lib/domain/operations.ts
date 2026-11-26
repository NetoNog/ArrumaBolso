import { categorize } from "@/lib/categorization";
import { addMonths, addMonthsToDate, compareMonths, daysInMonth, invoiceMonthForDate, normalizeDate, parseMonth } from "@/lib/dates";
import {
  autoSuggestCategory,
  CATEGORY_PRESETS,
  defaultNatureForPreset,
  findCategoryForPreset,
  inferPetExpenseKind,
  presetFromCategoryId,
  type PresetKey,
} from "@/lib/import/merchant-categories";
import type {
  Account,
  Card,
  CategorizationRule,
  Category,
  EditableField,
  FinanceState,
  IncomeSource,
  InvoiceMonth,
  InvoiceReconciliation,
  IsoDate,
  PaymentMethod,
  Pet,
  PetExpenseKind,
  QuickTemplate,
  RecurringSubscription,
  SavingsGoal,
  Transaction,
  TransactionLineItem,
  TransactionType,
  UserSettings,
} from "@/lib/domain/types";
import { newId } from "@/lib/hash";
import { fromCents, sumMoney, toCents } from "@/lib/money";

export type Recurrence =
  | { kind: "single" }
  | { kind: "installments"; count: number }
  | { kind: "subscription" };

export interface NewTransactionInput {
  type: TransactionType;
  payment_method: PaymentMethod;
  /** Card charged, only meaningful when `payment_method` is `credit_card`. */
  card_id?: string | null;
  /** Wallet/bank account debited or credited. */
  account_id?: string | null;
  /** Destination account for internal transfers between own accounts. */
  transfer_account_id?: string | null;
  date: IsoDate;
  title: string;
  /** For installments this is the TOTAL purchase amount, split across parcels. */
  amount: number;
  category_id: string | null;
  notes: string;
  tags?: string[];
  recurrence: Recurrence;
  /** Optional competence override; defaults to the cycle derived from `date`. */
  invoice_month?: InvoiceMonth;
  /** Links an income entry to an income source (ignored for other types). */
  income_source_id?: string | null;
  /** Links a reimbursement/refund entry to the expense it offsets. */
  refund_of_transaction_id?: string | null;
  /** International purchase details (optional). */
  original_currency?: string | null;
  original_amount?: number | null;
  iof_amount?: number | null;
  /** Receipt storage path & optional itemised lines. */
  receipt_path?: string | null;
  line_items?: TransactionLineItem[];
  /** Linked pet & pet expense subtype (Meu Pet module). */
  pet_id?: string | null;
  pet_expense_kind?: PetExpenseKind | null;
}

export type TransactionPatch = Partial<Pick<Transaction, EditableField>>;

const EDITABLE_FIELDS: readonly EditableField[] = [
  "clean_title",
  "amount",
  "date",
  "invoice_month",
  "category_id",
  "notes",
  "tags",
  "type",
  "payment_method",
  "card_id",
  "account_id",
  "transfer_account_id",
  "refund_of_transaction_id",
  "original_currency",
  "original_amount",
  "iof_amount",
  "receipt_path",
  "line_items",
  "pet_id",
  "pet_expense_kind",
  "installment_current",
  "installment_total",
];

/** Normalises a list of user tags (lowercase, no leading `#`, deduplicated). */
export function normalizeTags(tags?: readonly string[]): string[] {
  if (!tags) return [];
  return Array.from(
    new Set(
      tags
        .map((tag) => tag.trim().replace(/^#/, "").toLowerCase())
        .filter(Boolean),
    ),
  );
}

/** Parses a comma/space separated tag input like `#viagem, irpf` into clean tags. */
export function parseTagInput(input: string): string[] {
  return normalizeTags(input.split(/[\s,;]+/));
}

/** Resolves a card's effective cycle/limit/benefits, inheriting from `parent_card_id` for virtual/additional cards. */
export function effectiveCardConfig(state: FinanceState, card: Card): {
  closingDay: number;
  dueDay: number | null;
  creditLimit: number | null;
  cashbackRate: number | null;
  pointsPerDollar: number | null;
  annualFee: number | null;
  waiverMonthlySpend: number | null;
} {
  const parent = card.parent_card_id ? state.cards.find((item) => item.id === card.parent_card_id) : undefined;
  return {
    closingDay: card.closing_day ?? parent?.closing_day ?? state.settings.closing_day,
    dueDay: card.due_day ?? parent?.due_day ?? null,
    creditLimit: card.credit_limit ?? parent?.credit_limit ?? null,
    cashbackRate: card.cashback_rate ?? parent?.cashback_rate ?? null,
    pointsPerDollar: card.points_per_dollar ?? parent?.points_per_dollar ?? null,
    annualFee: card.annual_fee ?? parent?.annual_fee ?? null,
    waiverMonthlySpend: card.waiver_monthly_spend ?? parent?.waiver_monthly_spend ?? null,
  };
}

/** Card-specific closing day (inheriting parent card), falling back to the global profile setting. */
export function closingDayForCard(state: FinanceState, cardId: string | null | undefined): number {
  if (cardId) {
    const card = state.cards.find((item) => item.id === cardId);
    if (card) return effectiveCardConfig(state, card).closingDay;
  }
  return state.settings.closing_day;
}

/** Non-archived cards available for new expenses and active filters. */
export function activeCards(state: FinanceState): Card[] {
  return state.cards.filter((card) => !card.is_archived);
}

/** Default card id for new credit card expenses (`is_default`, or the first active card). */
export function defaultCardId(state: FinanceState): string | null {
  const active = activeCards(state);
  return active.find((card) => card.is_default)?.id ?? active[0]?.id ?? null;
}

/** Splits a total in cents so parcels sum exactly to the total (remainder on parcel 1). */
export function splitInstallments(total: number, count: number): number[] {
  const totalCents = toCents(total);
  const base = Math.trunc(totalCents / count);
  const remainder = totalCents - base * count;
  return Array.from({ length: count }, (_, index) => fromCents(index === 0 ? base + remainder : base));
}

function baseTransaction(now: string): Omit<
  Transaction,
  "id" | "date" | "invoice_month" | "raw_title" | "clean_title" | "amount" | "type" | "payment_method" | "category_id" | "notes"
> {
  return {
    batch_id: null,
    card_id: null,
    account_id: null,
    transfer_account_id: null,
    source: "manual",
    is_user_edited: false,
    locked_fields: [],
    is_ignored: false,
    subscription_id: null,
    income_source_id: null,
    tags: [],
    split_group_id: null,
    refund_of_transaction_id: null,
    original_currency: null,
    original_amount: null,
    iof_amount: null,
    receipt_path: null,
    line_items: [],
    pet_id: null,
    pet_expense_kind: null,
    installment_group_id: null,
    installment_current: null,
    installment_total: null,
    unique_hash: null,
    created_at: now,
    updated_at: now,
  };
}

export function createTransaction(
  state: FinanceState,
  input: NewTransactionInput,
  now: string = new Date().toISOString(),
): FinanceState {
  const title = input.title.trim();
  const cardId = input.payment_method === "credit_card" ? (input.card_id ?? null) : null;
  const closingDay = closingDayForCard(state, cardId);
  const invoiceMonth = input.invoice_month ?? invoiceMonthForDate(input.date, closingDay);
  const absAmount = Math.abs(input.amount);
  const signedAmount = input.type === "payment" ? -absAmount : absAmount;
  const tags = normalizeTags(input.tags);
  const common = {
    raw_title: title,
    clean_title: title,
    type: input.type,
    payment_method: input.payment_method,
    card_id: cardId,
    account_id: input.payment_method !== "credit_card" || input.type === "payment" ? (input.account_id ?? null) : null,
    transfer_account_id: input.type === "payment" ? (input.transfer_account_id ?? null) : null,
    category_id: input.type === "payment" ? null : input.category_id,
    notes: input.notes.trim(),
    tags,
    original_currency: input.original_currency?.trim().toUpperCase() || null,
    original_amount: input.original_amount !== undefined && input.original_amount !== null && input.original_amount > 0 ? input.original_amount : null,
    iof_amount: input.iof_amount !== undefined && input.iof_amount !== null && input.iof_amount >= 0 ? input.iof_amount : null,
    receipt_path: input.receipt_path ?? null,
    line_items: input.line_items ?? [],
    pet_id: input.pet_id ?? null,
    pet_expense_kind: input.pet_id ? (input.pet_expense_kind ?? inferPetExpenseKind(title)) : (input.pet_expense_kind ?? null),
  };

  if (input.recurrence.kind === "installments" && input.recurrence.count > 1) {
    const count = input.recurrence.count;
    const groupId = `inst_${newId()}`;
    const parcels = splitInstallments(signedAmount, count).map<Transaction>((amount, index) => ({
      ...baseTransaction(now),
      ...common,
      id: newId(),
      raw_title: `${title} - Parcela ${index + 1}/${count}`,
      date: addMonthsToDate(input.date, index),
      invoice_month: addMonths(invoiceMonth, index),
      amount,
      installment_group_id: groupId,
      installment_current: index + 1,
      installment_total: count,
    }));
    return { ...state, transactions: [...state.transactions, ...parcels] };
  }

  let subscriptions = state.recurring_subscriptions;
  let subscriptionId: string | null = null;
  if (input.recurrence.kind === "subscription" && input.type === "expense") {
    const subscription: RecurringSubscription = {
      id: newId(),
      title,
      expected_amount: absAmount,
      category_id: input.category_id,
      billing_day: Number(input.date.slice(8, 10)),
      active: true,
      frequency: "monthly",
      billing_month: null,
      payment_method: input.payment_method,
      card_id: cardId,
    };
    subscriptions = [...subscriptions, subscription];
    subscriptionId = subscription.id;
  }

  const refundTarget =
    input.type === "income" && input.refund_of_transaction_id
      ? state.transactions.find((tx) => tx.id === input.refund_of_transaction_id) ?? null
      : null;

  const tx: Transaction = {
    ...baseTransaction(now),
    ...common,
    id: newId(),
    date: input.date,
    invoice_month: invoiceMonth,
    amount: signedAmount,
    subscription_id: subscriptionId,
    income_source_id: input.type === "income" && !refundTarget ? (input.income_source_id ?? null) : null,
    refund_of_transaction_id: refundTarget?.id ?? null,
    category_id: refundTarget ? refundTarget.category_id : common.category_id,
  };
  return { ...state, transactions: [...state.transactions, tx], recurring_subscriptions: subscriptions };
}

/**
 * Applies a user edit. Any changed field is locked and the row is flagged with
 * `is_user_edited`, which shields it from future CSV re-imports.
 */
export function updateTransaction(
  state: FinanceState,
  id: string,
  patch: TransactionPatch,
  now: string = new Date().toISOString(),
): FinanceState {
  return {
    ...state,
    transactions: state.transactions.map((tx) => {
      if (tx.id !== id) return tx;
      const normalizedPatch: TransactionPatch =
        "tags" in patch ? { ...patch, tags: normalizeTags(patch.tags) } : patch;
      const changed = EDITABLE_FIELDS.filter((field) => {
        if (!(field in normalizedPatch)) return false;
        if (field === "tags") return JSON.stringify(normalizedPatch.tags ?? []) !== JSON.stringify(tx.tags ?? []);
        if (field === "line_items") return JSON.stringify(normalizedPatch.line_items ?? []) !== JSON.stringify(tx.line_items ?? []);
        return normalizedPatch[field] !== tx[field];
      });
      if (changed.length === 0) return tx;
      const next: Transaction = { ...tx, ...normalizedPatch };
      if (next.payment_method !== "credit_card") next.card_id = null;
      if (next.type !== "income") next.refund_of_transaction_id = null;
      if (next.type === "payment") next.amount = -Math.abs(next.amount);
      else if (normalizedPatch.amount !== undefined || normalizedPatch.type !== undefined) next.amount = Math.abs(next.amount);
      return {
        ...next,
        is_user_edited: true,
        locked_fields: Array.from(new Set([...tx.locked_fields, ...changed])),
        updated_at: now,
      };
    }),
  };
}

export interface SplitPartInput {
  category_id: string | null;
  amount: number;
  clean_title?: string;
  notes?: string;
}

/**
 * Splits a transaction across multiple categories/parts. The first part keeps
 * the original id & `unique_hash` so CSV re-imports stay idempotent; all parts
 * share a `split_group_id`.
 */
export function splitTransaction(
  state: FinanceState,
  id: string,
  parts: readonly SplitPartInput[],
  now: string = new Date().toISOString(),
): FinanceState {
  const original = state.transactions.find((tx) => tx.id === id);
  if (!original || parts.length < 2) return state;
  const validParts = parts.filter((part) => part.amount > 0);
  if (validParts.length < 2) return state;

  const groupId = original.split_group_id ?? `split_${newId()}`;
  const sign = original.type === "payment" ? -1 : 1;
  const [first, ...rest] = validParts;

  const updatedFirst: Transaction = {
    ...original,
    amount: sign * Math.abs(first.amount),
    category_id: first.category_id,
    clean_title: first.clean_title?.trim() || `${original.clean_title} (1/${validParts.length})`,
    notes: first.notes !== undefined ? first.notes.trim() : original.notes,
    split_group_id: groupId,
    is_user_edited: true,
    locked_fields: Array.from(new Set([...original.locked_fields, "amount", "category_id", "clean_title"])),
    updated_at: now,
  };

  const createdRest: Transaction[] = rest.map((part, index) => ({
    ...original,
    id: newId(),
    batch_id: original.batch_id,
    unique_hash: null,
    source: "manual",
    amount: sign * Math.abs(part.amount),
    category_id: part.category_id,
    clean_title: part.clean_title?.trim() || `${original.clean_title} (${index + 2}/${validParts.length})`,
    notes: part.notes !== undefined ? part.notes.trim() : original.notes,
    split_group_id: groupId,
    is_user_edited: true,
    locked_fields: ["amount", "category_id", "clean_title"],
    created_at: now,
    updated_at: now,
  }));

  const nextTransactions: Transaction[] = [];
  for (const tx of state.transactions) {
    if (tx.id === id) {
      nextTransactions.push(updatedFirst, ...createdRest);
    } else {
      nextTransactions.push(tx);
    }
  }
  return { ...state, transactions: nextTransactions };
}

export type DeleteScope = "single" | "following";

export function deleteTransactions(
  state: FinanceState,
  ids: readonly string[],
  scope: DeleteScope = "single",
  now: string = new Date().toISOString(),
): FinanceState {
  const targets = new Set(ids);
  if (scope === "following") {
    for (const tx of state.transactions) {
      if (!targets.has(tx.id) || !tx.installment_group_id || tx.installment_current === null) continue;
      for (const sibling of state.transactions) {
        if (
          sibling.installment_group_id === tx.installment_group_id &&
          sibling.installment_current !== null &&
          sibling.installment_current >= tx.installment_current
        ) {
          targets.add(sibling.id);
        }
      }
    }
  }

  const blacklisted = state.transactions
    .filter((tx) => targets.has(tx.id) && tx.unique_hash !== null)
    .filter((tx) => !state.deleted_csv_hashes.some((item) => item.unique_hash === tx.unique_hash))
    .map((tx) => ({ unique_hash: tx.unique_hash as string, raw_title: tx.raw_title, deleted_at: now }));

  return {
    ...state,
    transactions: state.transactions
      .filter((tx) => !targets.has(tx.id))
      .map((tx) =>
        tx.refund_of_transaction_id && targets.has(tx.refund_of_transaction_id)
          ? { ...tx, refund_of_transaction_id: null, updated_at: now }
          : tx,
      ),
    deleted_csv_hashes: [...state.deleted_csv_hashes, ...blacklisted],
  };
}

export function restoreDeletedHash(state: FinanceState, uniqueHash: string): FinanceState {
  return { ...state, deleted_csv_hashes: state.deleted_csv_hashes.filter((item) => item.unique_hash !== uniqueHash) };
}

export function duplicateTransaction(state: FinanceState, id: string, now: string = new Date().toISOString()): FinanceState {
  const original = state.transactions.find((tx) => tx.id === id);
  if (!original) return state;
  const copy: Transaction = {
    ...original,
    ...baseTransaction(now),
    id: newId(),
    raw_title: original.clean_title,
    clean_title: `${original.clean_title} (cópia)`,
    subscription_id: original.subscription_id,
    card_id: original.card_id,
    tags: [...(original.tags ?? [])],
  };
  return { ...state, transactions: [...state.transactions, copy] };
}

export function setIgnored(state: FinanceState, ids: readonly string[], ignored: boolean, now: string = new Date().toISOString()): FinanceState {
  const targets = new Set(ids);
  return {
    ...state,
    transactions: state.transactions.map((tx) =>
      targets.has(tx.id) ? { ...tx, is_ignored: ignored, is_user_edited: true, updated_at: now } : tx,
    ),
  };
}

export function bulkSetCategory(state: FinanceState, ids: readonly string[], categoryId: string | null, now: string = new Date().toISOString()): FinanceState {
  return ids.reduce((acc, id) => updateTransaction(acc, id, { category_id: categoryId }, now), state);
}

export function bulkUpdateTransactions(
  state: FinanceState,
  ids: readonly string[],
  patch: TransactionPatch,
  now: string = new Date().toISOString(),
): FinanceState {
  return ids.reduce((acc, id) => updateTransaction(acc, id, patch, now), state);
}

export function bulkAddTag(
  state: FinanceState,
  ids: readonly string[],
  rawTag: string,
  now: string = new Date().toISOString(),
): FinanceState {
  const [tag] = normalizeTags([rawTag]);
  if (!tag) return state;
  const targets = new Set(ids);
  return {
    ...state,
    transactions: state.transactions.map((tx) => {
      if (!targets.has(tx.id)) return tx;
      const existing = tx.tags ?? [];
      if (existing.includes(tag)) return tx;
      return {
        ...tx,
        tags: [...existing, tag],
        is_user_edited: true,
        locked_fields: Array.from(new Set([...tx.locked_fields, "tags"])),
        updated_at: now,
      };
    }),
  };
}

// ------------------------------------------------------ installment groups

/** Batch-edits title, category, or card across every parcel of an installment group. */
export function updateInstallmentGroup(
  state: FinanceState,
  groupId: string,
  patch: Pick<TransactionPatch, "clean_title" | "category_id" | "card_id">,
  now: string = new Date().toISOString(),
): FinanceState {
  const ids = state.transactions.filter((tx) => tx.installment_group_id === groupId).map((tx) => tx.id);
  return bulkUpdateTransactions(state, ids, patch, now);
}

/**
 * Anticipates/settles every parcel scheduled after `targetMonth` into a single
 * settlement entry in `targetMonth` (subtracting any bank discount), removing
 * the future parcels from projections.
 */
export function anticipateInstallments(
  state: FinanceState,
  groupId: string,
  targetMonth: InvoiceMonth,
  discountAmount: number,
  date: IsoDate,
  now: string = new Date().toISOString(),
): FinanceState {
  const parcels = state.transactions.filter((tx) => tx.installment_group_id === groupId && tx.type === "expense");
  const future = parcels.filter((tx) => compareMonths(tx.invoice_month, targetMonth) > 0);
  if (future.length === 0) return state;

  const gross = sumMoney(future.map((tx) => tx.amount));
  const discount = Math.max(0, Math.min(gross, Math.abs(discountAmount)));
  const net = Math.max(0.01, sumMoney([gross, -discount]));
  const reference = future[0];
  const futureIds = new Set(future.map((tx) => tx.id));

  const settlement: Transaction = {
    ...baseTransaction(now),
    id: newId(),
    date,
    invoice_month: targetMonth,
    raw_title: `Antecipação: ${reference.clean_title} (${future.length} parcelas)`,
    clean_title: `Antecipação: ${reference.clean_title}`,
    amount: net,
    type: "expense",
    payment_method: reference.payment_method,
    card_id: reference.card_id,
    category_id: reference.category_id,
    tags: [...(reference.tags ?? [])],
    notes:
      discount > 0
        ? `Quitação de ${future.length} parcela(s) futuras com desconto de R$ ${discount.toFixed(2).replace(".", ",")}.`
        : `Antecipação de ${future.length} parcela(s) futuras.`,
    installment_group_id: groupId,
    installment_current: reference.installment_total,
    installment_total: reference.installment_total,
  };

  return {
    ...state,
    transactions: [...state.transactions.filter((tx) => !futureIds.has(tx.id)), settlement],
  };
}

/** Creates a subscription from a transaction and links it. */
export function markAsSubscription(state: FinanceState, id: string, now: string = new Date().toISOString()): FinanceState {
  const tx = state.transactions.find((item) => item.id === id);
  if (!tx || tx.subscription_id) return state;
  const subscription: RecurringSubscription = {
    id: newId(),
    title: tx.clean_title,
    expected_amount: Math.abs(tx.amount),
    category_id: tx.category_id,
    billing_day: Number(tx.date.slice(8, 10)),
    active: true,
    frequency: "monthly",
    billing_month: null,
    payment_method: tx.payment_method,
    card_id: tx.card_id,
  };
  return {
    ...state,
    recurring_subscriptions: [...state.recurring_subscriptions, subscription],
    transactions: state.transactions.map((item) =>
      item.id === id ? { ...item, subscription_id: subscription.id, updated_at: now } : item,
    ),
  };
}

// ---------------------------------------------------------------- categories

export function upsertCategory(state: FinanceState, category: Omit<Category, "id"> & { id?: string }): FinanceState {
  const normalized = {
    ...category,
    parent_id: category.parent_id && category.parent_id !== category.id ? category.parent_id : null,
    nature: category.nature ?? "lifestyle",
  };
  if (category.id) {
    return { ...state, categories: state.categories.map((item) => (item.id === category.id ? { ...item, ...normalized, id: item.id } : item)) };
  }
  return { ...state, categories: [...state.categories, { ...normalized, id: newId() }] };
}

/** Deletes a category, optionally migrating its transactions/rules/subscriptions to another one. */
export function deleteCategory(state: FinanceState, id: string, migrateTo: string | null): FinanceState {
  const remap = <T extends { category_id: string | null }>(item: T): T =>
    item.category_id === id ? { ...item, category_id: migrateTo } : item;
  return {
    ...state,
    categories: state.categories
      .filter((item) => item.id !== id)
      .map((item) => (item.parent_id === id ? { ...item, parent_id: null } : item)),
    transactions: state.transactions.map(remap),
    recurring_subscriptions: state.recurring_subscriptions.map(remap),
    categorization_rules: state.categorization_rules.map(remap),
    quick_templates: (state.quick_templates ?? []).map(remap),
  };
}

// ------------------------------------------------------------------ accounts

export function upsertAccount(state: FinanceState, account: Omit<Account, "id"> & { id?: string }): FinanceState {
  const list = state.accounts ?? [];
  const normalized: Omit<Account, "id"> = {
    ...account,
    name: account.name.trim(),
    initial_balance: Number(account.initial_balance) || 0,
    is_archived: Boolean(account.is_archived),
  };
  if (account.id) {
    return { ...state, accounts: list.map((item) => (item.id === account.id ? { ...item, ...normalized, id: item.id } : item)) };
  }
  return { ...state, accounts: [...list, { ...normalized, id: newId() }] };
}

export function deleteAccount(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    accounts: (state.accounts ?? []).filter((item) => item.id !== id),
    transactions: state.transactions.map((tx) => ({
      ...tx,
      account_id: tx.account_id === id ? null : tx.account_id,
      transfer_account_id: tx.transfer_account_id === id ? null : tx.transfer_account_id,
    })),
    quick_templates: (state.quick_templates ?? []).map((tpl) =>
      tpl.account_id === id ? { ...tpl, account_id: null } : tpl,
    ),
  };
}

/** Records an internal transfer between two own accounts without inflating income or expenses. */
export function transferBetweenAccounts(
  state: FinanceState,
  input: { fromAccountId: string; toAccountId: string; amount: number; date: IsoDate; notes?: string },
  now: string = new Date().toISOString(),
): FinanceState {
  if (input.fromAccountId === input.toAccountId || !(input.amount > 0)) return state;
  const from = (state.accounts ?? []).find((a) => a.id === input.fromAccountId);
  const to = (state.accounts ?? []).find((a) => a.id === input.toAccountId);
  const date = normalizeDate(input.date);
  if (!from || !to || !date) return state;
  const title = `Transferência: ${from.name} → ${to.name}`;
  const tx: Transaction = {
    ...baseTransaction(now),
    id: newId(),
    date,
    invoice_month: invoiceMonthForDate(date, state.settings.closing_day),
    raw_title: title,
    clean_title: title,
    amount: -Math.abs(input.amount),
    type: "payment",
    payment_method: "pix_debit",
    account_id: from.id,
    transfer_account_id: to.id,
    category_id: null,
    notes: input.notes?.trim() ?? "",
  };
  return { ...state, transactions: [...state.transactions, tx] };
}

// ----------------------------------------------------------- quick templates

export function upsertQuickTemplate(
  state: FinanceState,
  template: Omit<QuickTemplate, "id"> & { id?: string },
): FinanceState {
  const list = state.quick_templates ?? [];
  const normalized: Omit<QuickTemplate, "id"> = {
    ...template,
    title: template.title.trim(),
    amount: Math.abs(template.amount),
    tags: normalizeTags(template.tags),
  };
  if (template.id) {
    return {
      ...state,
      quick_templates: list.map((item) => (item.id === template.id ? { ...item, ...normalized, id: item.id } : item)),
    };
  }
  return { ...state, quick_templates: [...list, { ...normalized, id: newId() }] };
}

export function deleteQuickTemplate(state: FinanceState, id: string): FinanceState {
  return { ...state, quick_templates: (state.quick_templates ?? []).filter((item) => item.id !== id) };
}

// ------------------------------------------------------------------- meu pet

export function upsertPet(state: FinanceState, pet: Omit<Pet, "id"> & { id?: string }): FinanceState {
  const list = state.pets ?? [];
  const normalized: Omit<Pet, "id"> = {
    ...pet,
    name: pet.name.trim(),
    breed: pet.breed.trim(),
    birth_date: pet.birth_date ? normalizeDate(pet.birth_date) : null,
    weight_kg: pet.weight_kg !== null && pet.weight_kg !== undefined && pet.weight_kg >= 0 ? Number(pet.weight_kg) : null,
    monthly_budget: Math.max(0, Number(pet.monthly_budget) || 0),
    color: pet.color || "#F59E0B",
    notes: pet.notes.trim(),
    is_archived: Boolean(pet.is_archived),
  };
  if (pet.id) {
    return {
      ...state,
      pets: list.map((item) => (item.id === pet.id ? { ...item, ...normalized, id: item.id } : item)),
    };
  }
  return { ...state, pets: [...list, { ...normalized, id: newId() }] };
}

export function archivePet(state: FinanceState, id: string, archived: boolean): FinanceState {
  return {
    ...state,
    pets: (state.pets ?? []).map((item) => (item.id === id ? { ...item, is_archived: archived } : item)),
  };
}

/** Removes a pet while keeping its transaction history intact (unlinked). */
export function deletePet(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    pets: (state.pets ?? []).filter((item) => item.id !== id),
    transactions: state.transactions.map((tx) =>
      tx.pet_id === id ? { ...tx, pet_id: null } : tx,
    ),
  };
}

/** Links an existing transaction to a pet in 1 click, auto-guessing the pet expense subtype if missing. */
export function assignTransactionToPet(
  state: FinanceState,
  transactionId: string,
  petId: string | null,
  kind?: PetExpenseKind | null,
  now: string = new Date().toISOString(),
): FinanceState {
  const tx = state.transactions.find((item) => item.id === transactionId);
  if (!tx) return state;
  const resolvedKind = petId ? (kind ?? tx.pet_expense_kind ?? inferPetExpenseKind(`${tx.clean_title} ${tx.raw_title}`)) : null;
  return updateTransaction(state, transactionId, { pet_id: petId, pet_expense_kind: resolvedKind }, now);
}

/** Returns an existing Pet category id or creates "Meu Pet" automatically. */
export function ensurePetCategory(state: FinanceState): { state: FinanceState; categoryId: string } {
  const preset = presetFromCategoryId("preset:pets");
  if (preset) {
    const existing = findCategoryForPreset(state.categories, preset);
    if (existing) return { state, categoryId: existing.id };
  }
  const created: Category = {
    id: newId(),
    name: "Meu Pet",
    icon: "paw-print",
    color: "#F59E0B",
    monthly_limit: 0,
    parent_id: null,
    nature: "lifestyle",
  };
  return { state: { ...state, categories: [...state.categories, created] }, categoryId: created.id };
}

/** Creates a category from a virtual `preset:<key>` id if needed, returning the real id + updated state. */
export function resolveOrCreatePresetCategory(
  state: FinanceState,
  id: string | null,
): { state: FinanceState; categoryId: string | null } {
  const preset = presetFromCategoryId(id);
  if (!preset) return { state, categoryId: id };
  const existing = findCategoryForPreset(state.categories, preset);
  if (existing) return { state, categoryId: existing.id };
  const created: Category = {
    id: newId(),
    name: preset.name,
    icon: preset.icon,
    color: preset.color,
    monthly_limit: 0,
    parent_id: null,
    nature: defaultNatureForPreset(preset.key),
  };
  return { state: { ...state, categories: [...state.categories, created] }, categoryId: created.id };
}

/** Batch-creates categories from built-in presets, skipping any that already exist (by name or alias). */
export function addPresetCategories(
  state: FinanceState,
  keys: readonly PresetKey[],
): { state: FinanceState; added: string[] } {
  const categories = [...state.categories];
  const added: string[] = [];
  const keySet = new Set(keys);
  for (const preset of CATEGORY_PRESETS) {
    if (!keySet.has(preset.key)) continue;
    if (findCategoryForPreset(categories, preset)) continue;
    categories.push({
      id: newId(),
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      monthly_limit: 0,
      parent_id: null,
      nature: defaultNatureForPreset(preset.key),
    });
    added.push(preset.name);
  }
  if (added.length === 0) return { state, added: [] };
  return { state: { ...state, categories }, added };
}

// --------------------------------------------------------------------- cards

export type CardInput = Omit<Card, "id">;

function normalizeCard(card: CardInput): CardInput {
  const lastFour = card.last_four?.replace(/\D/g, "").slice(-4) ?? "";
  const isArchived = Boolean(card.is_archived);
  return {
    ...card,
    name: card.name.trim(),
    brand: card.brand ?? null,
    last_four: lastFour.length === 4 ? lastFour : null,
    closing_day: card.closing_day && card.closing_day >= 1 && card.closing_day <= 28 ? card.closing_day : null,
    due_day: card.due_day && card.due_day >= 1 && card.due_day <= 31 ? card.due_day : null,
    credit_limit: card.credit_limit !== undefined && card.credit_limit !== null && card.credit_limit >= 0 ? card.credit_limit : null,
    is_default: isArchived ? false : Boolean(card.is_default),
    is_archived: isArchived,
    parent_card_id: card.parent_card_id || null,
    holder_name: card.holder_name?.trim() || null,
    cashback_rate: card.cashback_rate !== undefined && card.cashback_rate !== null && card.cashback_rate >= 0 ? card.cashback_rate : null,
    points_per_dollar: card.points_per_dollar !== undefined && card.points_per_dollar !== null && card.points_per_dollar >= 0 ? card.points_per_dollar : null,
    annual_fee: card.annual_fee !== undefined && card.annual_fee !== null && card.annual_fee >= 0 ? card.annual_fee : null,
    waiver_monthly_spend:
      card.waiver_monthly_spend !== undefined && card.waiver_monthly_spend !== null && card.waiver_monthly_spend >= 0
        ? card.waiver_monthly_spend
        : null,
  };
}

/** Adds a card and returns it, so callers can link rows to the new id. */
export function createCard(state: FinanceState, input: CardInput): { state: FinanceState; card: Card } {
  const normalized = normalizeCard(input);
  const card: Card = { ...normalized, id: newId() };
  const existing = card.is_default ? state.cards.map((item) => ({ ...item, is_default: false })) : state.cards;
  return { state: { ...state, cards: [...existing, card] }, card };
}

export function upsertCard(state: FinanceState, card: CardInput & { id?: string }): FinanceState {
  if (!card.id) return createCard(state, card).state;
  const normalized = normalizeCard(card);
  // Prevent self-parenting.
  if (normalized.parent_card_id === card.id) normalized.parent_card_id = null;
  return {
    ...state,
    cards: state.cards.map((item) => {
      if (item.id === card.id) return { ...item, ...normalized, id: item.id };
      return normalized.is_default ? { ...item, is_default: false } : item;
    }),
  };
}

/** Archives or reactivates a card while preserving 100% of its transaction history. */
export function archiveCard(state: FinanceState, id: string, archived: boolean): FinanceState {
  return {
    ...state,
    cards: state.cards.map((item) =>
      item.id === id ? { ...item, is_archived: archived, is_default: archived ? false : item.is_default } : item,
    ),
  };
}

/** Removes a card; its transactions, subscriptions, batches, child cards and reconciliations stay unlinked. */
export function deleteCard(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    cards: state.cards
      .filter((item) => item.id !== id)
      .map((item) => (item.parent_card_id === id ? { ...item, parent_card_id: null } : item)),
    transactions: state.transactions.map((tx) => (tx.card_id === id ? { ...tx, card_id: null } : tx)),
    import_batches: state.import_batches.map((batch) => (batch.card_id === id ? { ...batch, card_id: null } : batch)),
    recurring_subscriptions: state.recurring_subscriptions.map((sub) => (sub.card_id === id ? { ...sub, card_id: null } : sub)),
    invoice_reconciliations: (state.invoice_reconciliations ?? []).map((rec) =>
      rec.card_id === id ? { ...rec, card_id: null } : rec,
    ),
  };
}

export interface PayCardInvoiceInput {
  invoice_month: InvoiceMonth;
  card_id: string | null;
  amount: number;
  date: IsoDate;
  notes?: string;
}

/**
 * 1-click "Pagar fatura": records a `payment` entry for the invoice/card and
 * marks its reconciliation record as `paid`.
 */
export function payCardInvoice(
  state: FinanceState,
  input: PayCardInvoiceInput,
  now: string = new Date().toISOString(),
): FinanceState {
  const date = normalizeDate(input.date);
  if (!date || !(input.amount > 0)) return state;
  const card = input.card_id ? state.cards.find((item) => item.id === input.card_id) : undefined;
  const title = card ? `Pagamento fatura ${card.name}` : "Pagamento de fatura";
  const tx: Transaction = {
    ...baseTransaction(now),
    id: newId(),
    date,
    invoice_month: input.invoice_month,
    raw_title: title,
    clean_title: title,
    amount: -Math.abs(input.amount),
    type: "payment",
    payment_method: "credit_card",
    card_id: input.card_id,
    category_id: null,
    notes: input.notes?.trim() ?? "",
  };
  const withPayment: FinanceState = { ...state, transactions: [...state.transactions, tx] };
  return upsertInvoiceReconciliation(
    withPayment,
    {
      invoice_month: input.invoice_month,
      card_id: input.card_id,
      expected_total: Math.abs(input.amount),
      status: "paid",
      notes: input.notes?.trim() || "Pago em 1 clique",
    },
    now,
  );
}

// ------------------------------------------------------------- subscriptions

export function upsertSubscription(
  state: FinanceState,
  subscription: Omit<RecurringSubscription, "id"> & { id?: string },
): FinanceState {
  const normalized: Omit<RecurringSubscription, "id"> = {
    ...subscription,
    frequency: subscription.frequency ?? "monthly",
    billing_month: subscription.frequency && subscription.frequency !== "monthly" ? (subscription.billing_month ?? 1) : null,
    payment_method: subscription.payment_method ?? "credit_card",
    card_id: (subscription.payment_method ?? "credit_card") === "credit_card" ? (subscription.card_id ?? null) : null,
  };
  if (subscription.id) {
    return {
      ...state,
      recurring_subscriptions: state.recurring_subscriptions.map((item) =>
        item.id === subscription.id ? { ...item, ...normalized, id: item.id } : item,
      ),
    };
  }
  return { ...state, recurring_subscriptions: [...state.recurring_subscriptions, { ...normalized, id: newId() }] };
}

export function deleteSubscription(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    recurring_subscriptions: state.recurring_subscriptions.filter((item) => item.id !== id),
    transactions: state.transactions.map((tx) => (tx.subscription_id === id ? { ...tx, subscription_id: null } : tx)),
    categorization_rules: state.categorization_rules.map((rule) =>
      rule.subscription_id === id ? { ...rule, subscription_id: null } : rule,
    ),
  };
}

export interface PaySubscriptionInput {
  date: IsoDate;
  amount: number;
  invoice_month?: InvoiceMonth;
  notes?: string;
}

/** 1-click "Marcar como paga": records a recurring bill/subscription payment in the month. */
export function paySubscription(
  state: FinanceState,
  subscriptionId: string,
  input: PaySubscriptionInput,
  now: string = new Date().toISOString(),
): FinanceState {
  const sub = state.recurring_subscriptions.find((item) => item.id === subscriptionId);
  const date = normalizeDate(input.date);
  if (!sub || !date || !(input.amount > 0)) return state;
  const method = sub.payment_method ?? "credit_card";
  const cardId = method === "credit_card" ? (sub.card_id ?? null) : null;
  const closingDay = closingDayForCard(state, cardId);
  const tx: Transaction = {
    ...baseTransaction(now),
    id: newId(),
    date,
    invoice_month: input.invoice_month ?? invoiceMonthForDate(date, closingDay),
    raw_title: sub.title,
    clean_title: sub.title,
    amount: Math.abs(input.amount),
    type: "expense",
    payment_method: method,
    card_id: cardId,
    category_id: sub.category_id,
    subscription_id: sub.id,
    notes: input.notes?.trim() ?? "",
  };
  return { ...state, transactions: [...state.transactions, tx] };
}

// ------------------------------------------------------------ income sources

export function upsertIncomeSource(state: FinanceState, source: Omit<IncomeSource, "id"> & { id?: string }): FinanceState {
  const frequency = source.frequency ?? "monthly";
  const normalized: Omit<IncomeSource, "id"> = {
    ...source,
    frequency,
    pay_month: frequency === "annual" ? (source.pay_month ?? 12) : null,
    scheduled_month: frequency === "once" ? (source.scheduled_month ?? null) : null,
  };
  if (source.id) {
    return {
      ...state,
      income_sources: state.income_sources.map((item) => (item.id === source.id ? { ...item, ...normalized, id: item.id } : item)),
    };
  }
  return { ...state, income_sources: [...state.income_sources, { ...normalized, id: newId() }] };
}

/** Removes the source; entries already received stay as plain income. */
export function deleteIncomeSource(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    income_sources: state.income_sources.filter((item) => item.id !== id),
    transactions: state.transactions.map((tx) => (tx.income_source_id === id ? { ...tx, income_source_id: null } : tx)),
  };
}

/**
 * Date the source is expected to pay inside the cycle of `month`. The cycle of
 * invoice M runs from day `closingDay` of M-1 to the day before it in M, so a
 * pay day on or after the closing day falls in the previous calendar month.
 */
export function expectedPayDate(month: InvoiceMonth, payDay: number, closingDay: number): IsoDate {
  const target = payDay >= closingDay ? addMonths(month, -1) : month;
  const { year, month: monthNumber } = parseMonth(target);
  const day = Math.min(payDay, daysInMonth(year, monthNumber));
  return `${target}-${String(day).padStart(2, "0")}`;
}

export interface ReceiveIncomeInput {
  date: IsoDate;
  amount: number;
  notes?: string;
}

/** Records money received from an income source as an income entry linked to it. */
export function receiveIncome(
  state: FinanceState,
  sourceId: string,
  input: ReceiveIncomeInput,
  now: string = new Date().toISOString(),
): FinanceState {
  const source = state.income_sources.find((item) => item.id === sourceId);
  const date = normalizeDate(input.date);
  if (!source || !date || !(input.amount > 0)) return state;
  const tx: Transaction = {
    ...baseTransaction(now),
    id: newId(),
    date,
    invoice_month: invoiceMonthForDate(date, state.settings.closing_day),
    raw_title: source.title,
    clean_title: source.title,
    amount: Math.abs(input.amount),
    type: "income",
    payment_method: "pix_debit",
    category_id: null,
    notes: input.notes?.trim() ?? "",
    income_source_id: source.id,
  };
  return { ...state, transactions: [...state.transactions, tx] };
}

// --------------------------------------------------------------------- rules

export function upsertRule(state: FinanceState, rule: Omit<CategorizationRule, "id"> & { id?: string }): FinanceState {
  const normalized: Omit<CategorizationRule, "id"> = {
    ...rule,
    is_regex: Boolean(rule.is_regex),
    min_amount: rule.min_amount ?? null,
    max_amount: rule.max_amount ?? null,
    payment_method: rule.payment_method ?? null,
    subscription_id: rule.subscription_id ?? null,
    mark_ignored: Boolean(rule.mark_ignored),
  };
  if (rule.id) {
    return {
      ...state,
      categorization_rules: state.categorization_rules.map((item) => (item.id === rule.id ? { ...item, ...normalized, id: item.id } : item)),
    };
  }
  return { ...state, categorization_rules: [...state.categorization_rules, { ...normalized, id: newId() }] };
}

export function deleteRule(state: FinanceState, id: string): FinanceState {
  return { ...state, categorization_rules: state.categorization_rules.filter((item) => item.id !== id) };
}

export interface RulePreviewChange {
  transactionId: string;
  rawTitle: string;
  date: IsoDate;
  amount: number;
  beforeTitle: string;
  afterTitle: string;
  beforeCategoryId: string | null;
  afterCategoryId: string | null;
  beforeSubscriptionId: string | null;
  afterSubscriptionId: string | null;
  beforeIgnored: boolean;
  afterIgnored: boolean;
}

/** Computes what `reapplyRules` would change without mutating state (for preview dialogs). */
export function previewReapplyRules(state: FinanceState, onlyRuleId?: string): RulePreviewChange[] {
  const rules = onlyRuleId
    ? state.categorization_rules.filter((rule) => rule.id === onlyRuleId)
    : state.categorization_rules;
  if (rules.length === 0) return [];

  const changes: RulePreviewChange[] = [];
  for (const tx of state.transactions) {
    if (tx.is_user_edited || tx.source === "manual" || tx.type !== "expense") continue;
    const result = categorize(tx.raw_title, rules, { amount: tx.amount, paymentMethod: tx.payment_method });
    if (onlyRuleId && result.matchedRuleId !== onlyRuleId) continue;
    const categoryId = result.categoryId ?? tx.category_id;
    const subscriptionId = result.subscriptionId ?? tx.subscription_id;
    const isIgnored = result.markIgnored ? true : tx.is_ignored;
    if (
      result.cleanTitle === tx.clean_title &&
      categoryId === tx.category_id &&
      subscriptionId === tx.subscription_id &&
      isIgnored === tx.is_ignored
    ) {
      continue;
    }
    changes.push({
      transactionId: tx.id,
      rawTitle: tx.raw_title,
      date: tx.date,
      amount: tx.amount,
      beforeTitle: tx.clean_title,
      afterTitle: result.cleanTitle,
      beforeCategoryId: tx.category_id,
      afterCategoryId: categoryId,
      beforeSubscriptionId: tx.subscription_id,
      afterSubscriptionId: subscriptionId,
      beforeIgnored: tx.is_ignored,
      afterIgnored: isIgnored,
    });
  }
  return changes;
}

/**
 * Re-runs the rules (or a single rule) over imported rows the user never edited.
 * Edited and manual rows are left alone. Returns the new state and change count.
 */
export function reapplyRules(
  state: FinanceState,
  now: string = new Date().toISOString(),
  onlyRuleId?: string,
): { state: FinanceState; changed: number } {
  const changes = previewReapplyRules(state, onlyRuleId);
  if (changes.length === 0) return { state, changed: 0 };
  const byId = new Map(changes.map((change) => [change.transactionId, change]));
  const transactions = state.transactions.map((tx) => {
    const change = byId.get(tx.id);
    if (!change) return tx;
    return {
      ...tx,
      clean_title: change.afterTitle,
      category_id: change.afterCategoryId,
      subscription_id: change.afterSubscriptionId,
      is_ignored: change.afterIgnored,
      updated_at: now,
    };
  });
  return { state: { ...state, transactions }, changed: changes.length };
}

/**
 * Automatically categorises every uncategorised expense using user rules,
 * prior history, user category names, and the built-in merchant dictionary.
 * Creates missing preset categories automatically when needed.
 */
export function autoCategorizeUncategorized(
  state: FinanceState,
  now: string = new Date().toISOString(),
): { state: FinanceState; categorized: number; createdCategories: string[] } {
  const categories = [...state.categories];
  const createdCategories: string[] = [];
  let categorized = 0;

  const resolveCategoryId = (id: string | null): string | null => {
    const preset = presetFromCategoryId(id);
    if (!preset) return id;
    const existing = findCategoryForPreset(categories, preset);
    if (existing) return existing.id;
    const created: Category = {
      id: newId(),
      name: preset.name,
      icon: preset.icon,
      color: preset.color,
      monthly_limit: 0,
      parent_id: null,
      nature: defaultNatureForPreset(preset.key),
    };
    categories.push(created);
    createdCategories.push(created.name);
    return created.id;
  };

  const transactions = state.transactions.map((tx) => {
    if (tx.type !== "expense" || tx.is_ignored || tx.category_id) return tx;
    const fromRule = categorize(tx.raw_title, state.categorization_rules, {
      amount: tx.amount,
      paymentMethod: tx.payment_method,
    });
    const candidateId =
      fromRule.categoryId ??
      autoSuggestCategory({
        rawTitle: tx.raw_title,
        cleanTitle: tx.clean_title,
        bankCategory: null,
        categories,
        transactions: state.transactions,
      }).categoryId;
    const resolved = resolveCategoryId(candidateId);
    if (!resolved) return tx;
    categorized += 1;
    return { ...tx, category_id: resolved, updated_at: now };
  });

  if (categorized === 0) return { state, categorized: 0, createdCategories: [] };
  return { state: { ...state, categories, transactions }, categorized, createdCategories };
}

// ------------------------------------------------------------- savings goals

export function upsertSavingsGoal(state: FinanceState, goal: Omit<SavingsGoal, "id"> & { id?: string }): FinanceState {
  const list = state.savings_goals ?? [];
  if (goal.id) {
    return {
      ...state,
      savings_goals: list.map((item) => (item.id === goal.id ? { ...item, ...goal, id: item.id } : item)),
    };
  }
  return { ...state, savings_goals: [...list, { ...goal, id: newId() }] };
}

export function deleteSavingsGoal(state: FinanceState, id: string): FinanceState {
  return { ...state, savings_goals: (state.savings_goals ?? []).filter((item) => item.id !== id) };
}

export function contributeSavingsGoal(state: FinanceState, id: string, delta: number): FinanceState {
  return {
    ...state,
    savings_goals: (state.savings_goals ?? []).map((goal) =>
      goal.id === id ? { ...goal, current_amount: Math.max(0, sumMoney([goal.current_amount, delta])) } : goal,
    ),
  };
}

// --------------------------------------------------- invoice reconciliations

export function upsertInvoiceReconciliation(
  state: FinanceState,
  input: Omit<InvoiceReconciliation, "id" | "checked_at"> & { id?: string },
  now: string = new Date().toISOString(),
): FinanceState {
  const list = state.invoice_reconciliations ?? [];
  const existing =
    (input.id ? list.find((item) => item.id === input.id) : null) ??
    list.find((item) => item.invoice_month === input.invoice_month && (item.card_id ?? null) === (input.card_id ?? null));

  if (existing) {
    return {
      ...state,
      invoice_reconciliations: list.map((item) =>
        item.id === existing.id
          ? {
              ...item,
              expected_total: Math.max(0, input.expected_total),
              status: input.status,
              notes: input.notes.trim(),
              checked_at: now,
            }
          : item,
      ),
    };
  }
  return {
    ...state,
    invoice_reconciliations: [
      ...list,
      {
        id: newId(),
        invoice_month: input.invoice_month,
        card_id: input.card_id ?? null,
        expected_total: Math.max(0, input.expected_total),
        status: input.status,
        notes: input.notes.trim(),
        checked_at: now,
      },
    ],
  };
}

export function deleteInvoiceReconciliation(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    invoice_reconciliations: (state.invoice_reconciliations ?? []).filter((item) => item.id !== id),
  };
}

// ------------------------------------------------------------------ settings

export function updateSettings(state: FinanceState, patch: Partial<UserSettings>): FinanceState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function dismissAlert(state: FinanceState, key: string): FinanceState {
  if (state.settings.dismissed_alerts.includes(key)) return state;
  return updateSettings(state, { dismissed_alerts: [...state.settings.dismissed_alerts, key] });
}
