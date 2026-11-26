import type { Card, CardIssuer } from "@/lib/domain/types";

export interface IssuerInfo {
  issuer: CardIssuer;
  label: string;
  color: string;
  /** COMPE bank codes found in OFX files (`<BANKID>` / `<FID>`). */
  bankCodes: readonly string[];
  /** Normalised words that identify the bank in file names and OFX `<ORG>` tags. */
  keywords: readonly string[];
}

export const ISSUERS: readonly IssuerInfo[] = [
  { issuer: "nubank", label: "Nubank", color: "#820AD1", bankCodes: ["260"], keywords: ["nubank", "nu pagamentos", "nu financeira"] },
  { issuer: "inter", label: "Inter", color: "#FF7A00", bankCodes: ["077", "77"], keywords: ["inter", "banco inter", "bancointer"] },
  { issuer: "itau", label: "Itaú", color: "#EC7000", bankCodes: ["341"], keywords: ["itau", "itaucard", "itau unibanco"] },
  { issuer: "bradesco", label: "Bradesco", color: "#CC092F", bankCodes: ["237"], keywords: ["bradesco", "bradescard"] },
  { issuer: "santander", label: "Santander", color: "#EA1D25", bankCodes: ["033", "33"], keywords: ["santander"] },
  { issuer: "c6", label: "C6 Bank", color: "#242424", bankCodes: ["336"], keywords: ["c6", "c6 bank", "c6bank"] },
  { issuer: "bb", label: "Banco do Brasil", color: "#F8D117", bankCodes: ["001", "1"], keywords: ["banco do brasil", "bb", "ourocard"] },
  { issuer: "caixa", label: "Caixa", color: "#005CA9", bankCodes: ["104"], keywords: ["caixa", "cef"] },
  { issuer: "xp", label: "XP", color: "#111111", bankCodes: ["102", "348"], keywords: ["xp", "xp investimentos", "banco xp"] },
  { issuer: "other", label: "Outro banco", color: "#64748B", bankCodes: [], keywords: [] },
];

const BY_ISSUER = new Map(ISSUERS.map((info) => [info.issuer, info]));

export function issuerInfo(issuer: CardIssuer): IssuerInfo {
  return BY_ISSUER.get(issuer) ?? (BY_ISSUER.get("other") as IssuerInfo);
}

export function isCardIssuer(value: unknown): value is CardIssuer {
  return typeof value === "string" && BY_ISSUER.has(value as CardIssuer);
}

/** Lowercase, accent-free, punctuation collapsed to single spaces. */
export function normalizeText(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/** True when `keyword` appears in `text` as whole word(s). Both must be normalised. */
function containsWords(text: string, keyword: string): boolean {
  return ` ${text} `.includes(` ${keyword} `);
}

export function issuerFromBankCode(code: string | null | undefined): CardIssuer | null {
  const digits = (code ?? "").replace(/\D/g, "");
  if (!digits) return null;
  const trimmed = digits.replace(/^0+/, "") || "0";
  const match = ISSUERS.find((info) => info.bankCodes.some((bankCode) => (bankCode.replace(/^0+/, "") || "0") === trimmed));
  return match?.issuer ?? null;
}

/** Picks the issuer whose (longest) keyword appears in the text, e.g. a file name or an OFX `<ORG>`. */
export function issuerFromText(text: string | null | undefined): CardIssuer | null {
  const normalized = normalizeText(text ?? "");
  if (!normalized) return null;
  let best: { issuer: CardIssuer; length: number } | null = null;
  for (const info of ISSUERS) {
    for (const keyword of info.keywords) {
      if (containsWords(normalized, keyword) && (!best || keyword.length > best.length)) {
        best = { issuer: info.issuer, length: keyword.length };
      }
    }
  }
  return best?.issuer ?? null;
}

/**
 * Prefix mixed into the dedup hash of imported rows. Nubank keeps an empty scope so
 * hashes of files imported before multi-card support stay identical.
 */
export function hashScopeFor(issuer: CardIssuer | null): string {
  return !issuer || issuer === "nubank" ? "" : issuer;
}

/** Finds the registered card that best matches a detected issuer / last four digits. */
export function matchCard(cards: readonly Card[], issuer: CardIssuer | null, lastFour: string | null): Card | null {
  if (!issuer) return null;
  const sameIssuer = cards.filter((card) => card.issuer === issuer);
  if (lastFour) {
    const exact = sameIssuer.find((card) => card.last_four === lastFour);
    if (exact) return exact;
  }
  return sameIssuer[0] ?? null;
}

export function cardLabel(card: Card): string {
  return card.last_four ? `${card.name} •${card.last_four}` : card.name;
}
