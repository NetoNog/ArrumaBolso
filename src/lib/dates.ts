import type { InvoiceMonth, IsoDate } from "@/lib/domain/types";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function toIsoDate(date: Date): IsoDate {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date());
}

export function parseIsoDate(iso: IsoDate): { year: number; month: number; day: number } {
  const [year, month, day] = iso.split("-").map(Number);
  return { year, month, day };
}

export function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/**
 * Normalises `YYYY-MM-DD`, `DD/MM/YYYY` and `DD/MM/YY` into `YYYY-MM-DD`.
 * Returns `null` for invalid dates.
 */
export function normalizeDate(input: string): IsoDate | null {
  const text = input.trim();
  let year: number;
  let month: number;
  let day: number;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(text);
  const br = /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/.exec(text);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (br) {
    [day, month] = [Number(br[1]), Number(br[2])];
    year = br[3].length === 2 ? 2000 + Number(br[3]) : Number(br[3]);
  } else {
    return null;
  }

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth(year, month)) return null;
  return `${year}-${pad(month)}-${pad(day)}`;
}

export function monthOf(year: number, month: number): InvoiceMonth {
  return `${year}-${pad(month)}`;
}

export function parseMonth(value: InvoiceMonth): { year: number; month: number } {
  const [year, month] = value.split("-").map(Number);
  return { year, month };
}

export function addMonths(value: InvoiceMonth, delta: number): InvoiceMonth {
  const { year, month } = parseMonth(value);
  const index = year * 12 + (month - 1) + delta;
  return monthOf(Math.floor(index / 12), (index % 12) + 1);
}

export function compareMonths(a: InvoiceMonth, b: InvoiceMonth): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function monthRange(start: InvoiceMonth, count: number): InvoiceMonth[] {
  return Array.from({ length: count }, (_, index) => addMonths(start, index));
}

/** Adds months to a date, clamping the day to the target month length. */
export function addMonthsToDate(iso: IsoDate, delta: number): IsoDate {
  const { year, month, day } = parseIsoDate(iso);
  const target = parseMonth(addMonths(monthOf(year, month), delta));
  const clampedDay = Math.min(day, daysInMonth(target.year, target.month));
  return `${target.year}-${pad(target.month)}-${pad(clampedDay)}`;
}

/**
 * Card cycle rule: purchases made on or after the closing day belong to the
 * next month's invoice (e.g. closing day 2 → 07/11 falls in the Dec invoice).
 */
export function invoiceMonthForDate(iso: IsoDate, closingDay: number): InvoiceMonth {
  const { year, month, day } = parseIsoDate(iso);
  const base = monthOf(year, month);
  return day >= closingDay ? addMonths(base, 1) : base;
}

/** First and last calendar day covered by an invoice cycle. */
export function cycleBounds(invoice: InvoiceMonth, closingDay: number): { start: IsoDate; end: IsoDate } {
  const previous = parseMonth(addMonths(invoice, -1));
  const current = parseMonth(invoice);
  const startDay = Math.min(closingDay, daysInMonth(previous.year, previous.month));
  const start = `${previous.year}-${pad(previous.month)}-${pad(startDay)}`;
  const endDate = new Date(current.year, current.month - 1, Math.min(closingDay, daysInMonth(current.year, current.month)) - 1);
  return { start, end: toIsoDate(endDate) };
}

export function eachDay(start: IsoDate, end: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  const s = parseIsoDate(start);
  const cursor = new Date(s.year, s.month - 1, s.day);
  while (toIsoDate(cursor) <= end) {
    days.push(toIsoDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return days;
}

export function formatMonthLabel(value: InvoiceMonth): string {
  const { year, month } = parseMonth(value);
  return `${MONTH_SHORT[month - 1]}/${year}`;
}

export function formatDateBR(iso: IsoDate): string {
  const { year, month, day } = parseIsoDate(iso);
  return `${pad(day)}/${pad(month)}/${year}`;
}

export function formatDayMonth(iso: IsoDate): string {
  const { month, day } = parseIsoDate(iso);
  return `${pad(day)} ${MONTH_SHORT[month - 1]}`;
}

/** `Nubank_2026-12-09.csv` → `2026-12` (the due date month names the invoice). */
export function detectInvoiceMonthFromFilename(filename: string): InvoiceMonth | null {
  const match = /(\d{4})-(\d{2})-(\d{2})/.exec(filename);
  if (!match) return null;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  return `${match[1]}-${match[2]}`;
}
