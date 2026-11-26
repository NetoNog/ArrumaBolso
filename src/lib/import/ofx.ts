/**
 * OFX (1.x SGML and 2.x XML) statement parser. Supports both credit-card
 * statements (`<CCSTMTRS>`, amounts inverted so purchases are positive) and
 * bank checking-account statements (`<STMTRS>`, inflows positive, outflows negative).
 */
import { extractInstallment } from "@/lib/categorization";
import type { CardIssuer, IsoDate } from "@/lib/domain/types";
import { normalizeInstallmentTitle } from "@/lib/import/csv";
import { hashScopeFor } from "@/lib/import/issuers";
import { finalizeRows, type CsvParseError, type CsvParseResult, type RawStatementRow, type StatementKind } from "@/lib/import/rows";
import { parseAmount } from "@/lib/money";

export interface OfxAccountInfo {
  /** COMPE code from `<BANKID>` or `<FID>`. */
  bankCode: string | null;
  /** Institution name from `<ORG>`. */
  org: string | null;
  /** Last four digits of `<ACCTID>` (card or account number). */
  lastFour: string | null;
  isCreditCard: boolean;
}

export function looksLikeOfx(text: string): boolean {
  return /<OFX>/i.test(text) || /OFXHEADER/i.test(text.slice(0, 200));
}

function decodeEntities(value: string): string {
  return value
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&amp;/gi, "&");
}

/** Value of an SGML/XML leaf tag; closing tags are optional in OFX 1.x. */
function tagValue(block: string, tag: string): string | null {
  const match = new RegExp(`<${tag}>([^<\\r\\n]*)`, "i").exec(block);
  const value = match ? decodeEntities(match[1]).trim() : "";
  return value === "" ? null : value;
}

/** `20261107`, `20261107120000[-3:BRT]` → `2026-11-07`. */
function parseOfxDate(value: string | null): IsoDate | null {
  const match = /^(\d{4})(\d{2})(\d{2})/.exec(value ?? "");
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return `${match[1]}-${match[2]}-${match[3]}`;
}

export function readOfxAccount(text: string): OfxAccountInfo {
  const acctId = tagValue(text, "ACCTID");
  const digits = (acctId ?? "").replace(/\D/g, "");
  return {
    bankCode: tagValue(text, "BANKID") ?? tagValue(text, "FID"),
    org: tagValue(text, "ORG"),
    lastFour: digits.length >= 4 ? digits.slice(-4) : null,
    isCreditCard: /<CCSTMTRS>|<CREDITCARDMSGSRSV1>/i.test(text),
  };
}

export async function parseOfx(
  text: string,
  options: { issuer: CardIssuer | null; kind?: StatementKind },
): Promise<CsvParseResult> {
  if (!looksLikeOfx(text)) {
    return { rows: [], errors: [{ lineNumber: 1, message: "Arquivo OFX inválido: tag <OFX> não encontrada." }] };
  }

  const kind: StatementKind = options.kind ?? "credit_card";
  const blocks = text.match(/<STMTTRN>[\s\S]*?(?=<\/STMTTRN>|<STMTTRN>|<\/BANKTRANLIST>)/gi) ?? [];
  const errors: CsvParseError[] = [];
  const rows: RawStatementRow[] = [];

  for (const [index, block] of blocks.entries()) {
    const lineNumber = index + 1;
    const date = parseOfxDate(tagValue(block, "DTPOSTED"));
    const memo = tagValue(block, "MEMO");
    const name = tagValue(block, "NAME");
    const title = (memo && memo.length >= (name?.length ?? 0) ? memo : (name ?? memo) ?? "").replace(/\s{2,}/g, " ").trim();
    const value = parseAmount(tagValue(block, "TRNAMT") ?? "");

    if (!date) {
      errors.push({ lineNumber, message: `Transação ${lineNumber}: data inválida.` });
      continue;
    }
    if (!title) {
      errors.push({ lineNumber, message: `Transação ${lineNumber}: descrição vazia.` });
      continue;
    }
    if (value === null) {
      errors.push({ lineNumber, message: `Transação ${lineNumber}: valor inválido.` });
      continue;
    }
    if (value === 0) continue;

    const rawTitle = kind === "credit_card" ? normalizeInstallmentTitle(title, "") : title;
    rows.push({
      lineNumber,
      date,
      rawTitle,
      // Credit card statements invert debit sign; bank statements keep +inflow / -outflow.
      amount: kind === "credit_card" ? -value : value,
      installment: kind === "credit_card" ? extractInstallment(rawTitle) : null,
      bankCategory: null,
    });
  }

  if (blocks.length === 0) errors.push({ lineNumber: 1, message: "Nenhuma transação <STMTTRN> encontrada no OFX." });
  return { rows: await finalizeRows(rows, hashScopeFor(options.issuer), kind), errors };
}
