const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const percentFormatter = new Intl.NumberFormat("pt-BR", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});

export function toCents(value: number): number {
  return Math.round(value * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Sums monetary values in integer cents to avoid floating point drift. */
export function sumMoney(values: readonly number[]): number {
  return fromCents(values.reduce((acc, value) => acc + toCents(value), 0));
}

export function roundMoney(value: number): number {
  return fromCents(toCents(value));
}

export function formatBRL(value: number): string {
  // Intl outputs a non-breaking space after "R$"; normalise to a regular one.
  return brlFormatter.format(value).replace(/ /g, " ");
}

export function formatSignedBRL(value: number): string {
  const sign = value > 0 ? "+" : value < 0 ? "-" : "";
  return `${sign}${formatBRL(Math.abs(value))}`;
}

export function formatPercent(ratio: number): string {
  return percentFormatter.format(ratio).replace(/ /g, " ");
}

export function formatFixed2(value: number): string {
  return roundMoney(value).toFixed(2);
}

/**
 * Parses Brazilian and plain decimal amounts:
 * `"33,00"`, `"103,92"`, `"- 1.500,12"`, `"R$ 1.154,97"`, `"-1500.12"`, `"15.00"`.
 * Returns `null` when the input is not a number.
 */
export function parseAmount(input: string | number): number | null {
  if (typeof input === "number") return Number.isFinite(input) ? roundMoney(input) : null;

  let text = input.trim().replace(/R\$/gi, "").replace(/\s+/g, "");
  if (text === "") return null;

  let negative = false;
  if (text.startsWith("-")) {
    negative = true;
    text = text.slice(1);
  } else if (text.startsWith("(") && text.endsWith(")")) {
    negative = true;
    text = text.slice(1, -1);
  }

  if (text.includes(",")) {
    // Brazilian format: dots are thousand separators, comma is the decimal mark.
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (/^\d{1,3}(\.\d{3})+$/.test(text)) {
    // "1.500" without decimals is a Brazilian thousands-grouped integer.
    text = text.replace(/\./g, "");
  }

  if (!/^\d+(\.\d+)?$/.test(text)) return null;
  const value = Number(text);
  if (!Number.isFinite(value)) return null;
  return roundMoney(negative ? -value : value);
}
