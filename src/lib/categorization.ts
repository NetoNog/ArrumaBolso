import type { CategorizationRule } from "@/lib/domain/types";

/** Prefixes that Nubank/acquirers prepend to merchant names. */
const PREFIX_PATTERNS: readonly RegExp[] = [
  /^pix no cr[eé]dito\s*-\s*/i,
  /^mp\s*\*\s*/i,
  /^ifd\s*\*\s*/i,
  /^99food\s*\*\s*/i,
  /^pg\s*\*\s*/i,
  /^ec\s*\*\s*/i,
];

export const INSTALLMENT_PATTERN = /\s*-\s*Parcela\s+(\d+)\/(\d+)$/i;

export interface InstallmentInfo {
  current: number;
  total: number;
  baseTitle: string;
}

export function extractInstallment(rawTitle: string): InstallmentInfo | null {
  const match = INSTALLMENT_PATTERN.exec(rawTitle.trim());
  if (!match) return null;
  const current = Number(match[1]);
  const total = Number(match[2]);
  if (current < 1 || total < 2 || current > total) return null;
  return { current, total, baseTitle: rawTitle.trim().slice(0, match.index).trim() };
}

function titleCase(text: string): string {
  return text
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => (/\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

/** Builds a human friendly title while `raw_title` stays untouched for auditing. */
export function cleanTitle(rawTitle: string): string {
  let text = rawTitle.trim().replace(INSTALLMENT_PATTERN, "");
  for (const pattern of PREFIX_PATTERNS) text = text.replace(pattern, "");
  text = text.replace(/^tim\s*\*\s*tim\b/i, "Tim");
  text = text.replace(/\*/g, " ").replace(/\s{2,}/g, " ").trim();
  return titleCase(text || rawTitle.trim());
}

export function findMatchingRule(
  rawTitle: string,
  rules: readonly CategorizationRule[],
): CategorizationRule | null {
  const haystack = rawTitle.toLowerCase();
  const sorted = [...rules].sort((a, b) => b.priority - a.priority);
  return sorted.find((rule) => rule.pattern.trim() !== "" && haystack.includes(rule.pattern.trim().toLowerCase())) ?? null;
}

export interface Categorized {
  cleanTitle: string;
  categoryId: string | null;
}

export function categorize(rawTitle: string, rules: readonly CategorizationRule[]): Categorized {
  const rule = findMatchingRule(rawTitle, rules);
  const clean = rule?.clean_name_override?.trim() || cleanTitle(rawTitle);
  return { cleanTitle: clean, categoryId: rule?.category_id ?? null };
}
