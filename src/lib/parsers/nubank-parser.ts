import Papa from 'papaparse';
import { predictCategory } from './categorization-rules';
import { TransactionType } from '../supabase/types';

export interface ParsedNubankItem {
  id: string;
  date: string; // YYYY-MM-DD
  rawDate: string;
  originalTitle: string;
  cleanTitle: string;
  amount: number;
  type: TransactionType;
  categoryName: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  isInstallment: boolean;
  isPaymentOrReversal: boolean;
  hash: string;
  isDuplicate?: boolean;
  forceImport?: boolean;
  selected: boolean;
}

export interface ParseNubankResult {
  formatDetected: 'credit_card' | 'account_statement' | 'unknown';
  totalFound: number;
  newCount: number;
  duplicateCount: number;
  items: ParsedNubankItem[];
  error?: string;
}

// Sanitiza texto contra CSV Formula Injection (DDE) e caracteres perigosos
export function sanitizeText(text: string): string {
  if (!text) return '';
  let clean = text.trim();
  // Neutraliza fórmulas perigosas do Excel (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(clean)) {
    clean = `'${clean}`;
  }
  return clean;
}

// Gera um hash determinístico rápido para detecção de duplicatas (date + amount + normalizedTitle)
export function generateTransactionHash(date: string, amount: number, title: string, occurrenceIndex: number = 0): string {
  const normTitle = title.toLowerCase().trim().replace(/\s+/g, ' ');
  const normAmount = Math.abs(amount).toFixed(2);
  const raw = `${date}_${normAmount}_${normTitle}${occurrenceIndex > 0 ? `_#${occurrenceIndex}` : ''}`;
  
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Converte para inteiro 32-bit
  }
  return `nbk_${Math.abs(hash).toString(36)}_${raw.length}`;
}

// Normaliza datas em formatos como YYYY-MM-DD ou DD/MM/YYYY (com ou sem horário)
export function normalizeDate(rawDateStr: string): string {
  if (!rawDateStr) return new Date().toISOString().split('T')[0];
  const clean = rawDateStr.trim().split(' ')[0].split('T')[0];
  
  // DD/MM/YYYY ou D/M/YYYY
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(clean)) {
    const [day, month, year] = clean.split('/');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }
  
  // YYYY-MM-DD ou YYYY-M-D
  if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(clean)) {
    const [year, month, day] = clean.split('-');
    return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  }

  // Tenta Date.parse
  const parsed = new Date(rawDateStr.trim());
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return new Date().toISOString().split('T')[0];
}

// Converte valores textuais com vírgula ou ponto para float numérico
export function normalizeAmount(rawVal: any): number {
  if (typeof rawVal === 'number') return rawVal;
  if (!rawVal) return 0;

  let str = String(rawVal).trim().replace('R$', '').replace('$', '').trim();
  // Se contiver ponto e vírgula (ex: 1.250,50)
  if (str.includes('.') && str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  } else if (str.includes(',')) {
    str = str.replace(',', '.');
  }
  
  const num = parseFloat(str);
  return isNaN(num) ? 0 : num;
}

// Extrai parcelamento do título (ex: "Mercado Livre - Parcela 2/6", "Magalu 03/10", "Loja (01/05)")
export function extractInstallments(title: string): {
  cleanTitle: string;
  installmentCurrent?: number;
  installmentTotal?: number;
  isInstallment: boolean;
} {
  // Regex 1: "Parcela 2/6" ou "- Parcela 2/10"
  const regex1 = /(?: - | – )?parcela\s+(\d{1,2})\s*\/\s*(\d{1,2})/i;
  const match1 = title.match(regex1);
  if (match1) {
    const current = parseInt(match1[1], 10);
    const total = parseInt(match1[2], 10);
    const clean = title.replace(match1[0], '').trim();
    return {
      cleanTitle: clean || title,
      installmentCurrent: current,
      installmentTotal: total,
      isInstallment: true
    };
  }

  // Regex 2: "Nome do Merchant 02/10" ou "(02/10)"
  const regex2 = /[\s(](\d{1,2})\/(\d{1,2})\)?$/;
  const match2 = title.match(regex2);
  if (match2) {
    const current = parseInt(match2[1], 10);
    const total = parseInt(match2[2], 10);
    if (total <= 48 && current <= total && current > 0) {
      const clean = title.replace(match2[0], '').trim();
      return {
        cleanTitle: clean || title,
        installmentCurrent: current,
        installmentTotal: total,
        isInstallment: true
      };
    }
  }

  return {
    cleanTitle: title.trim(),
    isInstallment: false
  };
}

export function parseNubankCSV(
  csvContent: string,
  existingHashes: Set<string> = new Set()
): ParseNubankResult {
  // Remove BOM do início do arquivo para prevenir falhas de leitura de headers
  const cleanCsv = (csvContent || '').replace(/^\uFEFF/, '').trim();

  if (!cleanCsv) {
    return {
      formatDetected: 'unknown',
      totalFound: 0,
      newCount: 0,
      duplicateCount: 0,
      items: [],
      error: 'O arquivo CSV está vazio.'
    };
  }

  const result = Papa.parse<Record<string, string>>(cleanCsv, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase().replace(/^\uFEFF/, '')
  });

  if (result.errors && result.errors.length > 0 && (!result.data || result.data.length === 0)) {
    return {
      formatDetected: 'unknown',
      totalFound: 0,
      newCount: 0,
      duplicateCount: 0,
      items: [],
      error: `Erro ao processar CSV: ${result.errors[0].message}`
    };
  }

  const rows = result.data;
  if (rows.length === 0) {
    return {
      formatDetected: 'unknown',
      totalFound: 0,
      newCount: 0,
      duplicateCount: 0,
      items: [],
      error: 'Nenhuma linha de transação válida foi encontrada no arquivo.'
    };
  }

  // Identificação do formato
  const sample = rows[0];
  const headers = Object.keys(sample);

  const isCreditCard = headers.includes('title') || headers.includes('titulo') || headers.includes('título');
  const isAccountStatement = headers.includes('identificador') || (headers.includes('descrição') || headers.includes('descricao'));

  const formatDetected: 'credit_card' | 'account_statement' | 'unknown' = 
    isCreditCard ? 'credit_card' : isAccountStatement ? 'account_statement' : 'credit_card';

  const items: ParsedNubankItem[] = [];
  const fileSeenCount = new Map<string, number>();
  let duplicateCount = 0;

  rows.forEach((row, index) => {
    let rawDate = '';
    let rawTitle = '';
    let rawAmount = 0;
    let rawCategory = '';

    if (formatDetected === 'credit_card') {
      rawDate = row.date || row.data || '';
      rawTitle = row.title || row.titulo || row['título'] || row.description || row['descrição'] || 'Sem título';
      rawAmount = normalizeAmount(row.amount || row.valor || 0);
      rawCategory = row.category || row.categoria || '';
    } else {
      rawDate = row.data || row.date || '';
      rawTitle = row['descrição'] || row.descricao || row.identificador || row.title || row.description || 'Movimentação Conta';
      rawAmount = normalizeAmount(row.valor || row.amount || 0);
      rawCategory = row.categoria || row.category || '';
    }

    // Sanitiza contra CSV Formula Injection e caracteres perigosos
    rawTitle = sanitizeText(rawTitle);

    if (!rawDate && !rawTitle && rawAmount === 0) return;

    const normalizedDate = normalizeDate(rawDate);
    const { cleanTitle, installmentCurrent, installmentTotal, isInstallment } = extractInstallments(rawTitle);

    const lowerTitle = rawTitle.toLowerCase();
    const isPaymentOrReversal = 
      lowerTitle.includes('pagamento de fatura') || 
      lowerTitle.includes('pagamento recebido') || 
      lowerTitle.includes('estorno') || 
      rawAmount < 0;

    let type: TransactionType = 'expense';
    let finalAmount = Math.abs(rawAmount);

    if (formatDetected === 'account_statement') {
      type = rawAmount > 0 ? 'income' : 'expense';
    } else {
      type = (rawAmount < 0 || lowerTitle.includes('pagamento recebido') || lowerTitle.includes('estorno')) 
        ? 'transfer' 
        : 'expense';
    }

    const prediction = predictCategory(rawTitle, rawCategory);
    let finalCategory = prediction.categoryName;
    if (type === 'income') {
      finalCategory = 'Salário & Remuneração';
    } else if (isPaymentOrReversal && type === 'transfer') {
      finalCategory = 'Pagamento de Fatura';
    }

    // Suporte a múltiplas ocorrências idênticas legítimas no mesmo arquivo
    const baseKey = `${normalizedDate}_${finalAmount}_${rawTitle.toLowerCase().trim()}`;
    const occurrenceIndex = fileSeenCount.get(baseKey) || 0;
    fileSeenCount.set(baseKey, occurrenceIndex + 1);

    const hash = generateTransactionHash(normalizedDate, finalAmount, rawTitle, occurrenceIndex);
    const isDuplicate = existingHashes.has(hash);
    if (isDuplicate) {
      duplicateCount++;
    }

    items.push({
      id: `parsed_${Date.now()}_${index}`,
      date: normalizedDate,
      rawDate,
      originalTitle: rawTitle,
      cleanTitle,
      amount: finalAmount,
      type,
      categoryName: finalCategory,
      installmentCurrent,
      installmentTotal,
      isInstallment,
      isPaymentOrReversal,
      hash,
      isDuplicate,
      forceImport: false,
      selected: !isDuplicate
    });
  });

  return {
    formatDetected,
    totalFound: items.length,
    newCount: items.length - duplicateCount,
    duplicateCount,
    items
  };
}
