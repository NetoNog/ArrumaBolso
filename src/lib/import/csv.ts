/**
 * CSV statement parser for card and bank-account exports (Nubank, Inter, Itaú,
 * Bradesco...). Finds the header row, detects delimiter, maps known columns and
 * normalises signs and installments.
 */
import Papa from "papaparse";

import { extractInstallment } from "@/lib/categorization";
import { normalizeDate } from "@/lib/dates";
import type { CardIssuer } from "@/lib/domain/types";
import { hashScopeFor, normalizeText } from "@/lib/import/issuers";
import { finalizeRows, type CsvParseError, type CsvParseResult, type RawStatementRow, type StatementKind } from "@/lib/import/rows";
import { parseAmount } from "@/lib/money";

type Column = "date" | "title" | "amount" | "category" | "kind" | "usd";

const HEADER_ALIASES: Record<Column, readonly string[]> = {
  date: ["date", "data", "data da compra", "data de compra", "data compra", "data do lancamento", "data lancamento", "dt"],
  title: ["title", "titulo", "descricao", "description", "estabelecimento", "lancamento", "historico", "detalhe", "nome"],
  amount: ["valor em r", "valor r", "valor em reais", "valor brl", "valor", "amount", "value"],
  category: ["categoria", "category"],
  kind: ["tipo", "type"],
  usd: ["valor us", "valor em us", "valor usd", "valor em usd", "usd"],
};

const MAX_PREAMBLE_LINES = 40;
const TRAILING_INSTALLMENT = /\s*-?\s*(?:parc(?:ela)?\.?\s*)?(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})\s*$/i;
const KIND_INSTALLMENT = /parc(?:ela)?\.?\s*(\d{1,2})\s*(?:\/|de)\s*(\d{1,2})/i;

function resolveColumn(fields: readonly string[], column: Column): string | null {
  const normalized = fields.map((field) => normalizeText(field));
  for (const alias of HEADER_ALIASES[column]) {
    const index = normalized.indexOf(alias);
    if (index >= 0) return fields[index];
  }
  return null;
}

function detectDelimiter(line: string): string {
  const counts = [";", ",", "\t"].map((delimiter) => ({ delimiter, count: line.split(delimiter).length - 1 }));
  counts.sort((a, b) => b.count - a.count);
  return counts[0].count > 0 ? counts[0].delimiter : ",";
}

function splitLine(line: string, delimiter: string): string[] {
  return Papa.parse<string[]>(line, { delimiter }).data[0] ?? [];
}

function findHeader(lines: readonly string[]): { index: number; delimiter: string } | null {
  for (let index = 0; index < Math.min(lines.length, MAX_PREAMBLE_LINES); index += 1) {
    const line = lines[index];
    if (!line.trim()) continue;
    const delimiter = detectDelimiter(line);
    const cells = splitLine(line, delimiter);
    if (resolveColumn(cells, "date") && resolveColumn(cells, "title") && resolveColumn(cells, "amount")) {
      return { index, delimiter };
    }
  }
  return null;
}

export function normalizeInstallmentTitle(title: string, kind: string): string {
  if (extractInstallment(title)) return title;
  const fromKind = KIND_INSTALLMENT.exec(kind);
  if (fromKind) return `${title.trim()} - Parcela ${Number(fromKind[1])}/${Number(fromKind[2])}`;
  const trailing = TRAILING_INSTALLMENT.exec(title);
  if (trailing && trailing.index > 0) {
    const candidate = `${title.slice(0, trailing.index).trim()} - Parcela ${Number(trailing[1])}/${Number(trailing[2])}`;
    if (extractInstallment(candidate)) return candidate;
  }
  return title;
}

export interface StatementParseOptions {
  /** Bank of the statement; drives hashing scope and bank-specific normalisation. */
  issuer: CardIssuer | null;
  /** Credit-card bill (default) or checking/bank-account statement (Pix/Débito/Boleto). */
  kind?: StatementKind;
}

export async function parseStatementCsv(text: string, options: StatementParseOptions): Promise<CsvParseResult> {
  const kind: StatementKind = options.kind ?? "credit_card";
  const lines = text.replace(/^\uFEFF/, "").split(/\r\n|\n|\r/);
  const header = findHeader(lines);
  if (!header) {
    return {
      rows: [],
      errors: [{ lineNumber: 1, message: "Cabeçalho inválido: esperado colunas de data, descrição e valor (ex.: date,title,amount)." }],
    };
  }

  const firstLine = header.index + 1;
  const parsed = Papa.parse<Record<string, string>>(lines.slice(header.index).join("\n"), {
    header: true,
    delimiter: header.delimiter,
    skipEmptyLines: "greedy",
    transformHeader: (value) => value.trim(),
  });

  const errors: CsvParseError[] = parsed.errors.map((error) => ({
    lineNumber: (error.row ?? 0) + firstLine + 1,
    message: error.message,
  }));

  const fields = parsed.meta.fields ?? [];
  const dateCol = resolveColumn(fields, "date") as string;
  const titleCol = resolveColumn(fields, "title") as string;
  const amountCol = resolveColumn(fields, "amount") as string;
  const categoryCol = resolveColumn(fields, "category");
  const kindCol = resolveColumn(fields, "kind");
  const usdCol = resolveColumn(fields, "usd");
  const legacy = options.issuer === "nubank" && kind === "credit_card";
  const dateAliases = new Set(HEADER_ALIASES.date);

  const rows: RawStatementRow[] = [];
  for (const [index, record] of parsed.data.entries()) {
    const lineNumber = index + firstLine + 1;
    const dateCell = (record[dateCol] ?? "").trim();
    if (dateAliases.has(normalizeText(dateCell))) continue;
    if (!legacy && dateCell === "") continue;

    const date = normalizeDate(dateCell);
    const rowKind = kindCol ? (record[kindCol] ?? "").trim() : "";
    const title = (record[titleCol] ?? "").trim();
    let amount = parseAmount(record[amountCol] ?? "");

    if (!date) {
      errors.push({ lineNumber, message: `Data inválida: "${dateCell}"` });
      continue;
    }
    if (!title) {
      errors.push({ lineNumber, message: "Título vazio." });
      continue;
    }
    if (amount === null) {
      errors.push({ lineNumber, message: `Valor inválido: "${record[amountCol] ?? ""}"` });
      continue;
    }

    if (kind === "bank_account") {
      if (amount === 0) continue;
      if (/debito|saida|enviado|pagamento/.test(normalizeText(rowKind)) && amount > 0) amount = -amount;
      if (/credito|entrada|recebido/.test(normalizeText(rowKind)) && amount < 0) amount = -amount;
      rows.push({
        lineNumber,
        date,
        rawTitle: title,
        amount,
        installment: null,
        bankCategory: categoryCol ? (record[categoryCol] ?? "").trim() || null : null,
      });
      continue;
    }

    if (/pagamento|estorno|credito/.test(normalizeText(rowKind)) && amount > 0) amount = -amount;
    const rawTitle = legacy ? title : normalizeInstallmentTitle(title, rowKind);
    const usdAmount = usdCol ? parseAmount(record[usdCol] ?? "") : null;
    rows.push({
      lineNumber,
      date,
      rawTitle,
      amount,
      installment: extractInstallment(rawTitle),
      bankCategory: categoryCol ? (record[categoryCol] ?? "").trim() || null : null,
      originalCurrency: usdAmount && Math.abs(usdAmount) > 0 ? "USD" : null,
      originalAmount: usdAmount && Math.abs(usdAmount) > 0 ? Math.abs(usdAmount) : null,
    });
  }

  if (kind === "bank_account") {
    return { rows: await finalizeRows(rows, hashScopeFor(options.issuer), "bank_account"), errors };
  }

  const negatives = rows.filter((row) => row.amount < 0).length;
  const positives = rows.filter((row) => row.amount > 0).length;
  const normalized = !legacy && negatives > positives ? rows.map((row) => ({ ...row, amount: -row.amount })) : rows;

  return { rows: await finalizeRows(normalized, hashScopeFor(options.issuer), "credit_card"), errors };
}
