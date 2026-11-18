/**
 * Non-destructive reconciliation engine for Nubank credit card CSV exports.
 *
 * Guarantees:
 *  - Each CSV row gets a deterministic `unique_hash` (date | raw title | amount | same-day occurrence).
 *  - Re-importing the same (or a later, more complete) file never duplicates rows.
 *  - Rows edited by the user (`is_user_edited`) are never overwritten.
 *  - Rows deleted by the user (`deleted_csv_hashes`) never come back unless explicitly restored.
 *  - Manual transactions are never touched.
 */
import Papa from "papaparse";

import { categorize, extractInstallment, type InstallmentInfo } from "@/lib/categorization";
import { addMonths, addMonthsToDate, normalizeDate } from "@/lib/dates";
import type {
  FinanceState,
  ImportBatch,
  InvoiceMonth,
  IsoDate,
  Transaction,
  TransactionType,
} from "@/lib/domain/types";
import { newId, sha256Hex, stableKey } from "@/lib/hash";
import { formatFixed2, parseAmount } from "@/lib/money";

export interface ParsedCsvRow {
  lineNumber: number;
  date: IsoDate;
  rawTitle: string;
  amount: number;
  type: TransactionType;
  occurrenceIndex: number;
  uniqueHash: string;
  installment: InstallmentInfo | null;
}

export interface CsvParseError {
  lineNumber: number;
  message: string;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  errors: CsvParseError[];
}

export type RowStatus = "new" | "protected" | "existing" | "deleted";
export type RowAlert = "duplicate_same_day" | "installment" | "payment";

export interface ReconciledRow extends ParsedCsvRow {
  status: RowStatus;
  existingTransactionId: string | null;
  replacesProjectedId: string | null;
  installmentGroupId: string | null;
  suggestedCleanTitle: string;
  suggestedCategoryId: string | null;
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
  /** Category chosen by the user for new rows, keyed by CSV line number. */
  categoryOverrides: Record<number, string | null>;
  /** Hashes of user-deleted rows that should be restored by this import. */
  restoreHashes: ReadonlySet<string>;
}

const HEADER_ALIASES: Record<"date" | "title" | "amount", readonly string[]> = {
  date: ["date", "data"],
  title: ["title", "titulo", "título", "descricao", "descrição", "description", "estabelecimento"],
  amount: ["amount", "valor", "value"],
};

function resolveColumn(fields: readonly string[], key: keyof typeof HEADER_ALIASES): string | null {
  const aliases = HEADER_ALIASES[key];
  return fields.find((field) => aliases.includes(field.trim().toLowerCase())) ?? null;
}

export async function computeUniqueHash(
  date: IsoDate,
  rawTitle: string,
  amount: number,
  occurrenceIndex: number,
): Promise<string> {
  return sha256Hex(`${date}|${rawTitle.trim()}|${formatFixed2(amount)}|${occurrenceIndex}`);
}

export function detectType(rawTitle: string, amount: number): TransactionType {
  if (amount < 0 || rawTitle.trim().toLowerCase() === "pagamento recebido") return "payment";
  return "expense";
}

/**
 * Deterministic id shared by every installment of the same purchase. The origin
 * month (invoice of parcel 1) makes it stable across months and distinguishes
 * two identical purchases made in different cycles.
 */
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

export async function parseNubankCsv(text: string): Promise<CsvParseResult> {
  const parsed = Papa.parse<Record<string, string>>(text.replace(/^﻿/, ""), {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (header) => header.trim(),
  });

  const errors: CsvParseError[] = parsed.errors.map((error) => ({
    lineNumber: (error.row ?? 0) + 2,
    message: error.message,
  }));

  const fields = parsed.meta.fields ?? [];
  const dateCol = resolveColumn(fields, "date");
  const titleCol = resolveColumn(fields, "title");
  const amountCol = resolveColumn(fields, "amount");
  if (!dateCol || !titleCol || !amountCol) {
    return {
      rows: [],
      errors: [...errors, { lineNumber: 1, message: "Cabeçalho inválido: esperado date,title,amount." }],
    };
  }

  const occurrences = new Map<string, number>();
  const rows: ParsedCsvRow[] = [];

  for (const [index, record] of parsed.data.entries()) {
    const lineNumber = index + 2;
    const date = normalizeDate(record[dateCol] ?? "");
    const rawTitle = (record[titleCol] ?? "").trim();
    const amount = parseAmount(record[amountCol] ?? "");

    if (!date) {
      errors.push({ lineNumber, message: `Data inválida: "${record[dateCol] ?? ""}"` });
      continue;
    }
    if (!rawTitle) {
      errors.push({ lineNumber, message: "Título vazio." });
      continue;
    }
    if (amount === null) {
      errors.push({ lineNumber, message: `Valor inválido: "${record[amountCol] ?? ""}"` });
      continue;
    }

    const key = `${date}|${rawTitle}|${formatFixed2(amount)}`;
    const occurrenceIndex = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrenceIndex);

    rows.push({
      lineNumber,
      date,
      rawTitle,
      amount,
      type: detectType(rawTitle, amount),
      occurrenceIndex,
      uniqueHash: await computeUniqueHash(date, rawTitle, amount, occurrenceIndex),
      installment: extractInstallment(rawTitle),
    });
  }

  return { rows, errors };
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

    const suggestion = categorize(row.rawTitle, state.categorization_rules);

    return {
      ...row,
      status,
      existingTransactionId: existing?.id ?? null,
      replacesProjectedId: projected?.id ?? null,
      installmentGroupId: groupId,
      suggestedCleanTitle: suggestion.cleanTitle,
      suggestedCategoryId: row.type === "payment" ? null : (projected?.category_id ?? suggestion.categoryId),
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
  const transactions = [...state.transactions];
  const indexById = new Map(transactions.map((tx, index) => [tx.id, index]));
  const replacedProjectionIds: string[] = [];
  let deletedHashes = state.deleted_csv_hashes;
  let newCount = 0;

  const rowsToWrite = report.rows.filter(
    (row) => row.status === "new" || (row.status === "deleted" && decisions.restoreHashes.has(row.uniqueHash)),
  );

  for (const row of rowsToWrite) {
    if (row.status === "deleted") {
      deletedHashes = deletedHashes.filter((item) => item.unique_hash !== row.uniqueHash);
    }

    const categoryId =
      row.lineNumber in decisions.categoryOverrides
        ? decisions.categoryOverrides[row.lineNumber]
        : row.suggestedCategoryId;
    const subscriptionId = row.type === "expense" ? findSubscriptionId(state, row.suggestedCleanTitle) : null;

    const projectedIndex = row.replacesProjectedId ? indexById.get(row.replacesProjectedId) : undefined;
    if (projectedIndex !== undefined) {
      const projected = transactions[projectedIndex];
      transactions[projectedIndex] = projected.is_user_edited
        ? { ...projected, source: "csv", raw_title: row.rawTitle, unique_hash: row.uniqueHash, batch_id: batchId, updated_at: now }
        : {
            ...projected,
            source: "csv",
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
      payment_method: "nubank_card",
      category_id: row.type === "payment" ? null : categoryId,
      source: "csv",
      is_user_edited: false,
      locked_fields: [],
      is_ignored: false,
      subscription_id: subscriptionId,
      income_source_id: null,
      notes: "",
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

    // Project the remaining parcels into future invoices (unless they already exist).
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
      transactions,
      deleted_csv_hashes: deletedHashes,
      import_batches: [batch, ...state.import_batches],
    },
    batch,
  };
}

/**
 * Reverts a batch: removes the rows it created that the user has not edited and
 * turns installments it had matched back into projections.
 */
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
    // Any other unedited row created by this batch (CSV or projected) is dropped.
  }

  return {
    ...state,
    transactions,
    import_batches: state.import_batches.map((item) => (item.id === batchId ? { ...item, undone_at: now } : item)),
  };
}
