import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

/**
 * Converte de forma segura uma string de data 'YYYY-MM-DD' para Date local,
 * evitando o bug clássico de shift de fuso horário UTC (ex: UTC-3 Brasil).
 */
export function parseLocalDate(dateString: string): Date {
  if (!dateString) return new Date();
  const clean = dateString.trim().split('T')[0];
  const parts = clean.split('-').map(Number);
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(dateString);
}

/**
 * Aritmética de centavos inteiros para evitar floating point drift (IEEE-754)
 */
export function toCents(amount: number | string | null | undefined): number {
  const num = typeof amount === 'string' ? parseFloat(amount) : (amount ?? 0);
  return Math.round((isNaN(num) ? 0 : num) * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

export function formatCurrency(
  value: number | string | null | undefined,
  options?: { hideCents?: boolean }
): string {
  const num = typeof value === 'string' ? parseFloat(value) : (value ?? 0);
  if (isNaN(num)) return options?.hideCents ? 'R$ 0' : 'R$ 0,00';
  
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: options?.hideCents ? 0 : 2,
    maximumFractionDigits: options?.hideCents ? 0 : 2
  }).format(num);
}

export function formatDateBR(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = typeof dateString === 'string' ? parseLocalDate(dateString) : dateString;
    return format(d, 'dd/MM/yyyy', { locale: ptBR });
  } catch {
    return String(dateString);
  }
}

export function formatMonthYearBR(dateString: string | Date | null | undefined): string {
  if (!dateString) return '';
  try {
    const d = typeof dateString === 'string' ? parseLocalDate(dateString) : dateString;
    return format(d, 'MMMM yyyy', { locale: ptBR });
  } catch {
    return String(dateString);
  }
}

export function formatShortMonthBR(monthIndex: number, year?: number): string {
  const date = new Date(year || new Date().getFullYear(), monthIndex, 1);
  return format(date, 'MMM/yy', { locale: ptBR });
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || isNaN(value)) return '0%';
  return `${value.toFixed(1).replace('.', ',')}%`;
}
