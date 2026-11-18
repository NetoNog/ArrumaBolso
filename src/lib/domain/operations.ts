import { categorize } from "@/lib/categorization";
import { addMonths, addMonthsToDate, daysInMonth, invoiceMonthForDate, normalizeDate, parseMonth } from "@/lib/dates";
import type {
  CategorizationRule,
  Category,
  EditableField,
  FinanceState,
  IncomeSource,
  InvoiceMonth,
  IsoDate,
  PaymentMethod,
  RecurringSubscription,
  Transaction,
  TransactionType,
  UserSettings,
} from "@/lib/domain/types";
import { newId } from "@/lib/hash";
import { fromCents, toCents } from "@/lib/money";

export type Recurrence =
  | { kind: "single" }
  | { kind: "installments"; count: number }
  | { kind: "subscription" };

export interface NewTransactionInput {
  type: TransactionType;
  payment_method: PaymentMethod;
  date: IsoDate;
  title: string;
  /** For installments this is the TOTAL purchase amount, split across parcels. */
  amount: number;
  category_id: string | null;
  notes: string;
  recurrence: Recurrence;
  /** Optional competence override; defaults to the cycle derived from `date`. */
  invoice_month?: InvoiceMonth;
  /** Links an income entry to an income source (ignored for other types). */
  income_source_id?: string | null;
}

export type TransactionPatch = Partial<Pick<Transaction, EditableField>>;

const EDITABLE_FIELDS: readonly EditableField[] = [
  "clean_title",
  "amount",
  "date",
  "invoice_month",
  "category_id",
  "notes",
  "type",
  "payment_method",
  "installment_current",
  "installment_total",
];

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
    source: "manual",
    is_user_edited: false,
    locked_fields: [],
    is_ignored: false,
    subscription_id: null,
    income_source_id: null,
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
  const invoiceMonth = input.invoice_month ?? invoiceMonthForDate(input.date, state.settings.closing_day);
  const absAmount = Math.abs(input.amount);
  const signedAmount = input.type === "payment" ? -absAmount : absAmount;
  const common = {
    raw_title: title,
    clean_title: title,
    type: input.type,
    payment_method: input.payment_method,
    category_id: input.type === "payment" ? null : input.category_id,
    notes: input.notes.trim(),
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
    };
    subscriptions = [...subscriptions, subscription];
    subscriptionId = subscription.id;
  }

  const tx: Transaction = {
    ...baseTransaction(now),
    ...common,
    id: newId(),
    date: input.date,
    invoice_month: invoiceMonth,
    amount: signedAmount,
    subscription_id: subscriptionId,
    income_source_id: input.type === "income" ? (input.income_source_id ?? null) : null,
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
      const changed = EDITABLE_FIELDS.filter((field) => field in patch && patch[field] !== tx[field]);
      if (changed.length === 0) return tx;
      const next: Transaction = { ...tx, ...patch };
      if (next.type === "payment") next.amount = -Math.abs(next.amount);
      else if (patch.amount !== undefined || patch.type !== undefined) next.amount = Math.abs(next.amount);
      return {
        ...next,
        is_user_edited: true,
        locked_fields: Array.from(new Set([...tx.locked_fields, ...changed])),
        updated_at: now,
      };
    }),
  };
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
    transactions: state.transactions.filter((tx) => !targets.has(tx.id)),
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
  if (category.id) {
    return { ...state, categories: state.categories.map((item) => (item.id === category.id ? { ...item, ...category, id: item.id } : item)) };
  }
  return { ...state, categories: [...state.categories, { ...category, id: newId() }] };
}

/** Deletes a category, optionally migrating its transactions/rules/subscriptions to another one. */
export function deleteCategory(state: FinanceState, id: string, migrateTo: string | null): FinanceState {
  const remap = <T extends { category_id: string | null }>(item: T): T =>
    item.category_id === id ? { ...item, category_id: migrateTo } : item;
  return {
    ...state,
    categories: state.categories.filter((item) => item.id !== id),
    transactions: state.transactions.map(remap),
    recurring_subscriptions: state.recurring_subscriptions.map(remap),
    categorization_rules: state.categorization_rules.map(remap),
  };
}

// ------------------------------------------------------------- subscriptions

export function upsertSubscription(
  state: FinanceState,
  subscription: Omit<RecurringSubscription, "id"> & { id?: string },
): FinanceState {
  if (subscription.id) {
    return {
      ...state,
      recurring_subscriptions: state.recurring_subscriptions.map((item) =>
        item.id === subscription.id ? { ...item, ...subscription, id: item.id } : item,
      ),
    };
  }
  return { ...state, recurring_subscriptions: [...state.recurring_subscriptions, { ...subscription, id: newId() }] };
}

export function deleteSubscription(state: FinanceState, id: string): FinanceState {
  return {
    ...state,
    recurring_subscriptions: state.recurring_subscriptions.filter((item) => item.id !== id),
    transactions: state.transactions.map((tx) => (tx.subscription_id === id ? { ...tx, subscription_id: null } : tx)),
  };
}

// ------------------------------------------------------------ income sources

export function upsertIncomeSource(state: FinanceState, source: Omit<IncomeSource, "id"> & { id?: string }): FinanceState {
  if (source.id) {
    return {
      ...state,
      income_sources: state.income_sources.map((item) => (item.id === source.id ? { ...item, ...source, id: item.id } : item)),
    };
  }
  return { ...state, income_sources: [...state.income_sources, { ...source, id: newId() }] };
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
  if (rule.id) {
    return {
      ...state,
      categorization_rules: state.categorization_rules.map((item) => (item.id === rule.id ? { ...item, ...rule, id: item.id } : item)),
    };
  }
  return { ...state, categorization_rules: [...state.categorization_rules, { ...rule, id: newId() }] };
}

export function deleteRule(state: FinanceState, id: string): FinanceState {
  return { ...state, categorization_rules: state.categorization_rules.filter((item) => item.id !== id) };
}

/**
 * Re-runs the rules over imported rows the user never edited. Edited and manual
 * rows are left alone. Returns the new state and how many rows changed.
 */
export function reapplyRules(state: FinanceState, now: string = new Date().toISOString()): { state: FinanceState; changed: number } {
  let changed = 0;
  const transactions = state.transactions.map((tx) => {
    if (tx.is_user_edited || tx.source === "manual" || tx.type !== "expense") return tx;
    const result = categorize(tx.raw_title, state.categorization_rules);
    const categoryId = result.categoryId ?? tx.category_id;
    if (result.cleanTitle === tx.clean_title && categoryId === tx.category_id) return tx;
    changed += 1;
    return { ...tx, clean_title: result.cleanTitle, category_id: categoryId, updated_at: now };
  });
  return { state: changed === 0 ? state : { ...state, transactions }, changed };
}

// ------------------------------------------------------------------ settings

export function updateSettings(state: FinanceState, patch: Partial<UserSettings>): FinanceState {
  return { ...state, settings: { ...state.settings, ...patch } };
}

export function dismissAlert(state: FinanceState, key: string): FinanceState {
  if (state.settings.dismissed_alerts.includes(key)) return state;
  return updateSettings(state, { dismissed_alerts: [...state.settings.dismissed_alerts, key] });
}
