import { invoiceMonthForDate } from "@/lib/dates";
import type { InvoiceMonth, IsoDate } from "@/lib/domain/types";
import type { ParsedCsvRow } from "@/lib/import/rows";
import { sumMoney } from "@/lib/money";

export interface StatementPreview {
  count: number;
  /** Sum of purchases (positive rows). */
  purchasesTotal: number;
  /** Sum of payments and refunds, as a positive number. */
  creditsTotal: number;
  firstDate: IsoDate | null;
  lastDate: IsoDate | null;
}

export function summarizeStatement(rows: readonly Pick<ParsedCsvRow, "date" | "amount">[]): StatementPreview {
  const dates = rows.map((row) => row.date).sort();
  return {
    count: rows.length,
    purchasesTotal: sumMoney(rows.filter((row) => row.amount > 0).map((row) => row.amount)),
    creditsTotal: sumMoney(rows.filter((row) => row.amount < 0).map((row) => -row.amount)),
    firstDate: dates[0] ?? null,
    lastDate: dates[dates.length - 1] ?? null,
  };
}

/**
 * Invoice a statement most likely belongs to: the cycle of its latest purchase.
 * Payments are ignored because they are usually made after the cycle closes.
 */
export function suggestInvoiceMonth(
  rows: readonly Pick<ParsedCsvRow, "date" | "amount">[],
  closingDay: number,
): InvoiceMonth | null {
  const purchases = rows.filter((row) => row.amount > 0).map((row) => row.date).sort();
  const latest = purchases[purchases.length - 1];
  return latest ? invoiceMonthForDate(latest, closingDay) : null;
}
