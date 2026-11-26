/**
 * Non-destructive reconciliation engine for credit card and bank statements (CSV/OFX).
 * Parsing lives in `@/lib/import`.
 */
import { categorize, extractInstallment } from "@/lib/categorization";
import { addMonths, addMonthsToDate } from "@/lib/dates";
import type {
  CategorizationRule,
  Category,
  FinanceState,
  ImportBatch,
  InvoiceMonth,
  PaymentMethod,
  Transaction,
} from "@/lib/domain/types";
import { parseStatementCsv } from "@/lib/import/csv";
import {
  autoSuggestCategory,
  findCategoryForPreset,
  presetCategoryId,
  presetFromCategoryId,
  type CategorySuggestionSource,
} from "@/lib/import/merchant-categories";
import type { CsvParseError, CsvParseResult, ParsedCsvRow } from "@/lib/import/rows";
import { newId, stableKey } from "@/lib/hash";
import { formatFixed2 } from "@/lib/money";

export { computeUniqueHash, detectType } from "@/lib/import/rows";
export type { CsvParseError, CsvParseResult, ParsedCsvRow } from "@/lib/import/rows";

export type RowStatus = "new" | "protected" | "existing" | "deleted";
export type RowAlert = "duplicate_same_day" | "installment" | "payment";

export interface ReconciledRow extends ParsedCsvRow {
  status: RowStatus;
  existingTransactionId: string | null;
  replacesProjectedId: string | null;
  installmentGroupId: string | null;
  suggestedCleanTitle: string;
  /** Existing category id, a virtual `preset:<key>` id (auto-categorised) or null. */
  suggestedCategoryId: string | null;
  /** How `suggestedCategoryId` was inferred automatically. */
  suggestedCategorySource?: CategorySuggestionSource;
  /** Subscription matched via an explicit rule, if any. */
  suggestedSubscriptionId?: string | null;
  /** True when a matching rule flags the row as ignored. */
  suggestedIgnored?: boolean;
  alerts: RowAlert[];
}

export interface ReconciliationSummary {
  newCount: number;
  protectedCount: number;
  existingCount: number;
  deletedCount: number;
  alertCount: number;
}

export interface ReconciliationReport {
  filename: string;
  invoiceMonth: InvoiceMonth;
  rows: ReconciledRow[];
  errors: CsvParseError[];
  summary: ReconciliationSummary;
}

export interface ImportDecisions {
  categoryOverrides: Record<number, string | null>;
  restoreHashes: ReadonlySet<string>;
  /** Card the statement belongs to (`null` for bank-account statements). */
  cardId: string | null;
  /** When true, manual category choices in `categoryOverrides` are saved as reusable rules. */
  learnRules?: boolean;
  /** When true, any remaining uncategorised expenses fall back to the "Outros" category. */
  fallbackToOther?: boolean;
}

export function installmentGroupId(
  baseTitle: string,
  total: number,
  amount: number,
  invoiceMonth: InvoiceMonth,
  current: number,
): string {
  const originMonth = addMonths(invoiceMonth, -(current - 1));
  return `inst_${stableKey(`${baseTitle.trim().toLowerCase()}|${total}|${formatFixed2(amount)}|${originMonth}`)}`;
}

/** Parses a Nubank `date,title,amount` export (legacy hashing scope). */
export async function parseNubankCsv(text: string): Promise<CsvParseResult> {
  return parseStatementCsv(text, { issuer: "nubank" });
}

export function reconcile(
  parsed: CsvParseResult,
  state: FinanceState,
  options: { filename: string; invoiceMonth: InvoiceMonth },
): ReconciliationReport {
  const byHash = new Map<string, Transaction>();
  for (const tx of state.transactions) if (tx.unique_hash) byHash.set(tx.unique_hash, tx);
  const deleted = new Set(state.deleted_csv_hashes.map((item) => item.unique_hash));

  const sameDayCount = new Map<string, number>();
  for (const row of parsed.rows) {
    const key = `${row.date}|${row.rawTitle}|${formatFixed2(row.amount)}`;
    sameDayCount.set(key, (sameDayCount.get(key) ?? 0) + 1);
  }

  const rows: ReconciledRow[] = parsed.rows.map((row) => {
    const existing = byHash.get(row.uniqueHash) ?? null;
    let status: RowStatus;
    if (deleted.has(row.uniqueHash)) status = "deleted";
    else if (existing?.is_user_edited) status = "protected";
    else if (existing) status = "existing";
    else status = "new";

    const groupId = row.installment
      ? installmentGroupId(row.installment.baseTitle, row.installment.total, row.amount, options.invoiceMonth, row.installment.current)
      : null;

    const projected =
      status === "new" && groupId && row.installment
        ? state.transactions.find(
            (tx) =>
              tx.source === "projected" &&
              tx.installment_group_id === groupId &&
              tx.installment_current === row.installment?.current,
          ) ?? null
        : null;

    const alerts: RowAlert[] = [];
    if ((sameDayCount.get(`${row.date}|${row.rawTitle}|${formatFixed2(row.amount)}`) ?? 0) > 1) {
      alerts.push("duplicate_same_day");
    }
    if (row.installment) alerts.push("installment");
    if (row.type === "payment") alerts.push("payment");

    const paymentMethod: PaymentMethod = row.paymentMethod ?? "credit_card";
    const suggestion = categorize(row.rawTitle, state.categorization_rules, { amount: row.amount, paymentMethod });

    let suggestedCategoryId: string | null = null;
    let suggestedCategorySource: CategorySuggestionSource = null;
    if (row.type !== "payment" && row.type !== "income") {
      if (projected?.category_id) {
        suggestedCategoryId = projected.category_id;
        suggestedCategorySource = "history";
      } else if (suggestion.categoryId) {
        suggestedCategoryId = suggestion.categoryId;
        suggestedCategorySource = "rule";
      } else {
        const auto = autoSuggestCategory({
          rawTitle: row.rawTitle,
          cleanTitle: suggestion.cleanTitle,
          bankCategory: row.bankCategory,
          categories: state.categories,
          transactions: state.transactions,
        });
        suggestedCategoryId = auto.categoryId;
        suggestedCategorySource = auto.source;
      }
    }

    return {
      ...row,
      status,
      existingTransactionId: existing?.id ?? null,
      replacesProjectedId: projected?.id ?? null,
      installmentGroupId: groupId,
      suggestedCleanTitle: suggestion.cleanTitle,
      suggestedCategoryId,
      suggestedCategorySource,
      suggestedSubscriptionId: suggestion.subscriptionId,
      suggestedIgnored: suggestion.markIgnored,
      alerts,
    };
  });

  const summary: ReconciliationSummary = {
    newCount: rows.filter((row) => row.status === "new").length,
    protectedCount: rows.filter((row) => row.status === "protected").length,
    existingCount: rows.filter((row) => row.status === "existing").length,
    deletedCount: rows.filter((row) => row.status === "deleted").length,
    alertCount: rows.filter(
      (row) => row.status === "new" && row.alerts.some((alert) => alert !== "payment"),
    ).length,
  };

  return { filename: options.filename, invoiceMonth: options.invoiceMonth, rows, errors: parsed.errors, summary };
}

function findSubscriptionId(state: FinanceState, cleanTitle: string): string | null {
  const title = cleanTitle.toLowerCase();
  const match = state.recurring_subscriptions.find((sub) => {
    const subTitle = sub.title.toLowerCase();
    return title.includes(subTitle) || subTitle.includes(title);
  });
  return match?.id ?? null;
}

export interface ApplyImportResult {
  state: FinanceState;
  batch: ImportBatch;
}

/** Writes the reconciled rows. Pure: returns a new state, never mutates the input. */
export function applyImport(
  state: FinanceState,
  report: ReconciliationReport,
  decisions: ImportDecisions,
  now: string = new Date().toISOString(),
): ApplyImportResult {
  const batchId = newId();
  const categories = [...state.categories];
  const rules: CategorizationRule[] = [...state.categorization_rules];
  const transactions = [...state.transactions];
  const indexById = new Map(transactions.map((tx, index) => [tx.id, index]));
  const replacedProjectionIds: string[] = [];
  let deletedHashes = state.deleted_csv_hashes;
  let newCount = 0;

  const resolveCategoryId = (id: string | null): string | null => {
    const preset = presetFromCategoryId(id);
    if (!preset) return id;
    const existing = findCategoryForPreset(categories, preset);
    if (existing) return existing.id;
    const created: Category = { id: newId(), name: preset.name, icon: preset.icon, color: preset.color, monthly_limit: 0 };
    categories.push(created);
    return created.id;
  };

  const rowsToWrite = report.rows.filter(
    (row) => row.status === "new" || (row.status === "deleted" && decisions.restoreHashes.has(row.uniqueHash)),
  );

  for (const row of rowsToWrite) {
    if (row.status === "deleted") {
      deletedHashes = deletedHashes.filter((item) => item.unique_hash !== row.uniqueHash);
    }

    const chosenRawCategory =
      row.lineNumber in decisions.categoryOverrides ? decisions.categoryOverrides[row.lineNumber] : row.suggestedCategoryId;
    const withFallback =
      !chosenRawCategory && decisions.fallbackToOther && row.type === "expense"
        ? presetCategoryId("outros")
        : chosenRawCategory;
    const categoryId = row.type === "payment" || row.type === "income" ? null : resolveCategoryId(withFallback);

    // Learn a reusable rule whenever the user explicitly picked a category during review.
    if (decisions.learnRules && row.type === "expense" && row.lineNumber in decisions.categoryOverrides && categoryId) {
      const pattern = (extractInstallment(row.rawTitle)?.baseTitle ?? row.rawTitle).trim().toLowerCase();
      if (pattern.length >= 2) {
        const existingRuleIdx = rules.findIndex((r) => !r.is_regex && r.pattern.trim().toLowerCase() === pattern);
        if (existingRuleIdx >= 0) {
          rules[existingRuleIdx] = { ...rules[existingRuleIdx], category_id: categoryId };
        } else {
          rules.push({
            id: newId(),
            pattern,
            clean_name_override: null,
            category_id: categoryId,
            priority: 100,
            is_regex: false,
            min_amount: null,
            max_amount: null,
            payment_method: null,
            subscription_id: null,
            mark_ignored: false,
          });
        }
      }
    }
    const subscriptionId =
      row.type === "expense"
        ? (row.suggestedSubscriptionId ?? findSubscriptionId(state, row.suggestedCleanTitle))
        : null;
    const paymentMethod: PaymentMethod = row.paymentMethod ?? "credit_card";
    const cardId = paymentMethod === "credit_card" ? decisions.cardId : null;

    const projectedIndex = row.replacesProjectedId ? indexById.get(row.replacesProjectedId) : undefined;
    if (projectedIndex !== undefined) {
      const projected = transactions[projectedIndex];
      transactions[projectedIndex] = projected.is_user_edited
        ? { ...projected, source: "csv", raw_title: row.rawTitle, unique_hash: row.uniqueHash, batch_id: batchId, card_id: projected.card_id ?? cardId, updated_at: now }
        : {
            ...projected,
            source: "csv",
            card_id: cardId,
            batch_id: batchId,
            date: row.date,
            invoice_month: report.invoiceMonth,
            raw_title: row.rawTitle,
            clean_title: row.suggestedCleanTitle,
            amount: row.amount,
            category_id: categoryId,
            unique_hash: row.uniqueHash,
            updated_at: now,
          };
      replacedProjectionIds.push(projected.id);
      newCount += 1;
      continue;
    }

    const tx: Transaction = {
      id: newId(),
      batch_id: batchId,
      date: row.date,
      invoice_month: report.invoiceMonth,
      raw_title: row.rawTitle,
      clean_title: row.type === "payment" ? "Pagamento recebido" : row.suggestedCleanTitle,
      amount: row.amount,
      type: row.type,
      payment_method: paymentMethod,
      card_id: cardId,
      category_id: categoryId,
      source: "csv",
      is_user_edited: false,
      locked_fields: [],
      is_ignored: Boolean(row.suggestedIgnored),
      subscription_id: subscriptionId,
      income_source_id: null,
      notes: "",
      tags: [],
      split_group_id: null,
      refund_of_transaction_id: null,
      original_currency: row.originalCurrency ?? null,
      original_amount: row.originalAmount ?? null,
      iof_amount: null,
      installment_group_id: row.installmentGroupId,
      installment_current: row.installment?.current ?? null,
      installment_total: row.installment?.total ?? null,
      unique_hash: row.uniqueHash,
      created_at: now,
      updated_at: now,
    };
    indexById.set(tx.id, transactions.length);
    transactions.push(tx);
    newCount += 1;

    if (row.installment && row.installmentGroupId && row.installment.current < row.installment.total) {
      for (let parcel = row.installment.current + 1; parcel <= row.installment.total; parcel += 1) {
        const offset = parcel - row.installment.current;
        const exists = transactions.some(
          (item) => item.installment_group_id === row.installmentGroupId && item.installment_current === parcel,
        );
        if (exists) continue;
        const projected: Transaction = {
          ...tx,
          id: newId(),
          date: addMonthsToDate(row.date, offset),
          invoice_month: addMonths(report.invoiceMonth, offset),
          raw_title: `${row.installment.baseTitle} - Parcela ${parcel}/${row.installment.total}`,
          source: "projected",
          unique_hash: null,
          installment_current: parcel,
        };
        indexById.set(projected.id, transactions.length);
        transactions.push(projected);
      }
    }
  }

  const summary = report.summary;
  const restoredCount = rowsToWrite.filter((row) => row.status === "deleted").length;
  const batch: ImportBatch = {
    id: batchId,
    filename: report.filename,
    invoice_month: report.invoiceMonth,
    card_id: decisions.cardId,
    new_count: newCount,
    skipped_count: summary.existingCount + summary.deletedCount - restoredCount,
    protected_count: summary.protectedCount,
    replaced_projection_ids: replacedProjectionIds,
    undone_at: null,
    created_at: now,
  };

  return {
    state: {
      ...state,
      categories,
      categorization_rules: rules,
      transactions,
      deleted_csv_hashes: deletedHashes,
      import_batches: [batch, ...state.import_batches],
    },
    batch,
  };
}

export function undoImportBatch(state: FinanceState, batchId: string, now: string = new Date().toISOString()): FinanceState {
  const batch = state.import_batches.find((item) => item.id === batchId);
  if (!batch || batch.undone_at) return state;
  const replaced = new Set(batch.replaced_projection_ids);

  const transactions: Transaction[] = [];
  for (const tx of state.transactions) {
    if (tx.batch_id !== batchId || tx.is_user_edited) {
      transactions.push(tx);
      continue;
    }
    if (replaced.has(tx.id)) {
      transactions.push({ ...tx, source: "projected", unique_hash: null, batch_id: null, updated_at: now });
    }
  }

  return {
    ...state,
    transactions,
    import_batches: state.import_batches.map((item) => (item.id === batchId ? { ...item, undone_at: now } : item)),
  };
}
