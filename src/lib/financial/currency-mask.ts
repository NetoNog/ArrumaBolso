/**
 * Utilitários de Máscara e Parsing Decimal Automático de Moeda (BRL)
 * Padrão Bancário: deslocamento de centavos automático ao digitar (ex: 1 -> 0,01 -> 0,15 -> 1,50 -> 15,00)
 */

/**
 * Aplica máscara de moeda automática (centavos dinâmicos)
 */
export function maskCurrency(val: string | number | null | undefined, prevVal: string = ''): string {
  if (val === null || val === undefined || val === '') return '';

  // Se já for número
  if (typeof val === 'number') {
    if (isNaN(val) || val === 0) return '';
    return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  const str = String(val);

  // Permite operadores de calculadora (ex: 120+45) exceto se for apenas um sinal negativo no início
  if (/[+*/]/.test(str) || (str.includes('-') && str.indexOf('-') !== 0)) {
    return str;
  }

  const isNegative = str.trim().startsWith('-');

  // Extrai apenas os dígitos
  const onlyDigits = str.replace(/\D/g, '');
  if (!onlyDigits) return isNegative ? '-' : '';

  const cents = parseInt(onlyDigits, 10);
  if (isNaN(cents) || cents === 0) {
    if (prevVal === '0,00' || prevVal === '0' || onlyDigits.length <= 1) return '';
    return '0,00';
  }

  const num = cents / 100;
  const formatted = num.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return isNegative ? `-${formatted}` : formatted;
}

/**
 * Converte qualquer valor mascarado (ex: "1.500,50" ou "0,15") em float numérico puro (ex: 1500.5)
 */
export function parseCurrency(val: string | number | null | undefined): number {
  if (val === null || val === undefined || val === '') return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;

  const str = String(val).trim();

  // Avaliação de expressão matemática se houver operadores
  if (/[+*/-]/.test(str)) {
    try {
      const sanitized = str.replace(',', '.').replace(/[^0-9+*/().-]/g, '');
      const evaluated = Function(`"use strict"; return (${sanitized});`)();
      if (typeof evaluated === 'number' && !isNaN(evaluated) && isFinite(evaluated)) {
        return Math.round(evaluated * 100) / 100;
      }
    } catch {
      // fallback abaixo
    }
  }

  // Remove pontos de milhar e troca vírgula por ponto
  const clean = str.replace(/\./g, '').replace(',', '.');
  const num = parseFloat(clean);
  return isNaN(num) ? 0 : num;
}

/**
 * Formata um número vindo do banco ou estado para exibição inicial no input mascarado
 */
export function formatNumberToCurrencyInput(val: number | string | null | undefined): string {
  if (val === null || val === undefined || val === '') return '';
  const num = typeof val === 'number' ? val : parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
  if (isNaN(num) || num === 0) return '';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
