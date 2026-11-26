/**
 * Entry point of statement imports: decodes the file, detects its format (CSV or
 * OFX), statement kind (credit card or bank account) and issuing bank.
 */
import type { CardIssuer } from "@/lib/domain/types";
import { parseStatementCsv } from "@/lib/import/csv";
import { issuerFromBankCode, issuerFromText, normalizeText } from "@/lib/import/issuers";
import { looksLikeOfx, parseOfx, readOfxAccount } from "@/lib/import/ofx";
import type { CsvParseResult, StatementKind } from "@/lib/import/rows";

export type StatementFormat = "csv" | "ofx";
export type { StatementKind };

export type DetectionSource = "ofx_bank_code" | "ofx_org" | "filename" | "csv_header";

export interface StatementDetection {
  format: StatementFormat;
  statementKind: StatementKind;
  issuer: CardIssuer | null;
  /** How the issuer was identified (null when it was not). */
  source: DetectionSource | null;
  /** Last four digits of the card/account, when the file carries the account number. */
  lastFour: string | null;
}

export const SUPPORTED_EXTENSIONS = [".csv", ".ofx", ".qfx"] as const;

export function isSupportedFile(filename: string): boolean {
  const lower = filename.toLowerCase();
  return SUPPORTED_EXTENSIONS.some((extension) => lower.endsWith(extension));
}

/** Decodes UTF-8 and falls back to Windows-1252, the charset most Brazilian banks still export. */
export function decodeStatementBytes(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

function issuerFromCsvHeader(text: string): CardIssuer | null {
  const head = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).slice(0, 40).map(normalizeText);
  if (head[0] === "date title amount") return "nubank";
  if (head.some((line) => /\blancamento\b/.test(line) && /\bcategoria\b/.test(line) && /\btipo\b/.test(line))) return "inter";
  if (head.some((line) => /\bhistorico\b/.test(line) && /\bvalor us\b/.test(line))) return "bradesco";
  return null;
}

function looksLikeBankCsv(filename: string, text: string): boolean {
  const name = normalizeText(filename);
  if (/\bextrato\b|\bconta\b|\bcorrente\b|\bpix\b/.test(name)) return true;
  const head = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/).slice(0, 15).map(normalizeText);
  return head.some((line) => /\bsaldo\b/.test(line) && /\bvalor\b/.test(line));
}

export function detectStatement(filename: string, text: string): StatementDetection {
  const isOfx = /\.(ofx|qfx)$/i.test(filename) || looksLikeOfx(text);
  const fromFilename = issuerFromText(filename.replace(/\.[a-z0-9]+$/i, ""));

  if (isOfx) {
    const account = readOfxAccount(text);
    const fromCode = issuerFromBankCode(account.bankCode);
    const fromOrg = issuerFromText(account.org);
    const issuer = fromCode ?? fromOrg ?? fromFilename;
    const source: DetectionSource | null = fromCode ? "ofx_bank_code" : fromOrg ? "ofx_org" : fromFilename ? "filename" : null;
    const hasBankTag = /<BANKMSGSRSV1>|<STMTRS>/i.test(text);
    const statementKind: StatementKind = !account.isCreditCard && hasBankTag ? "bank_account" : "credit_card";
    return { format: "ofx", statementKind, issuer, source, lastFour: account.lastFour };
  }

  const fromHeader = issuerFromCsvHeader(text);
  const issuer = fromFilename ?? fromHeader;
  const statementKind: StatementKind = looksLikeBankCsv(filename, text) ? "bank_account" : "credit_card";
  return {
    format: "csv",
    statementKind,
    issuer,
    source: fromFilename ? "filename" : fromHeader ? "csv_header" : null,
    lastFour: null,
  };
}

export async function parseStatement(
  format: StatementFormat,
  text: string,
  issuer: CardIssuer | null,
  kind: StatementKind = "credit_card",
): Promise<CsvParseResult> {
  return format === "ofx" ? parseOfx(text, { issuer, kind }) : parseStatementCsv(text, { issuer, kind });
}
