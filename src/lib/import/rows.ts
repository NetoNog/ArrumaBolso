import type { InstallmentInfo } from "@/lib/categorization";
import type { IsoDate, PaymentMethod, TransactionType } from "@/lib/domain/types";
import { sha256Hex } from "@/lib/hash";
import { formatFixed2 } from "@/lib/money";

export type StatementKind = "credit_card" | "bank_account";

/** One statement line, normalised for either credit-card or bank-account imports. */
export interface ParsedCsvRow {
  lineNumber: number;
  date: IsoDate;
  rawTitle: string;
  amount: number;
  type: TransactionType;
  paymentMethod?: PaymentMethod;
  occurrenceIndex: number;
  uniqueHash: string;
  installment: InstallmentInfo | null;
  /** Category the bank itself assigned (e.g. Inter's "Categoria" column), if any. */
  bankCategory: string | null;
  /** Foreign currency ISO code (e.g. `USD`) when exported by the bank. */
  originalCurrency?: string | null;
  /** Original foreign-currency amount, when present in the statement. */
  originalAmount?: number | null;
}

export interface CsvParseError {
  lineNumber: number;
  message: string;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  errors: CsvParseError[];
}

/**
 * Deterministic row identity. `scope` separates banks so the same purchase on two
 * cards never collides; it is empty for Nubank to keep legacy hashes stable.
 */
export async function computeUniqueHash(
  date: IsoDate,
  rawTitle: string,
  amount: number,
  occurrenceIndex: number,
  scope = "",
): Promise<string> {
  const base = `${date}|${rawTitle.trim()}|${formatFixed2(amount)}|${occurrenceIndex}`;
  return sha256Hex(scope ? `${scope}|${base}` : base);
}

const BANK_INVOICE_PAYMENT_RE = /pag(?:amento|to)?\s*(?:de\s*)?fatura|fatura\s+(?:do\s+)?cart[aã]o|pag(?:amento|to)?\s+cart[aã]o/i;

export function detectType(rawTitle: string, amount: number, kind: StatementKind = "credit_card"): TransactionType {
  if (kind === "bank_account") {
    if (amount < 0 && BANK_INVOICE_PAYMENT_RE.test(rawTitle)) return "payment";
    return amount > 0 ? "income" : "expense";
  }
  if (amount < 0 || rawTitle.trim().toLowerCase() === "pagamento recebido") return "payment";
  return "expense";
}

export function detectBankPaymentMethod(rawTitle: string): PaymentMethod {
  if (/\bboleto\b|\btitulo\b|\bconv[eê]nio\b|\bdarf\b|\biptu\b|\bipva\b/i.test(rawTitle)) return "boleto";
  return "pix_debit";
}

export interface RawStatementRow {
  lineNumber: number;
  date: IsoDate;
  rawTitle: string;
  amount: number;
  installment: InstallmentInfo | null;
  bankCategory: string | null;
  originalCurrency?: string | null;
  originalAmount?: number | null;
}

/** Assigns same-day occurrence indexes and hashes, in file order. */
export async function finalizeRows(
  rows: readonly RawStatementRow[],
  scope: string,
  kind: StatementKind = "credit_card",
): Promise<ParsedCsvRow[]> {
  const occurrences = new Map<string, number>();
  const result: ParsedCsvRow[] = [];
  const effectiveScope = kind === "bank_account" ? `bank:${scope || "default"}` : scope;

  for (const row of rows) {
    const type = detectType(row.rawTitle, row.amount, kind);
    const normalizedAmount =
      kind === "bank_account"
        ? type === "payment"
          ? -Math.abs(row.amount)
          : Math.abs(row.amount)
        : row.amount;
    const key = `${row.date}|${row.rawTitle}|${formatFixed2(normalizedAmount)}`;
    const occurrenceIndex = (occurrences.get(key) ?? 0) + 1;
    occurrences.set(key, occurrenceIndex);
    result.push({
      ...row,
      amount: normalizedAmount,
      type,
      paymentMethod: kind === "bank_account" ? detectBankPaymentMethod(row.rawTitle) : "credit_card",
      occurrenceIndex,
      uniqueHash: await computeUniqueHash(row.date, row.rawTitle, normalizedAmount, occurrenceIndex, effectiveScope),
    });
  }
  return result;
}
