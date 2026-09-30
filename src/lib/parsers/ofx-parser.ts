import { DEFAULT_CATEGORIZATION_RULES } from './categorization-rules';
import { sanitizeText, ParsedNubankItem, ParseNubankResult } from './nubank-parser';
import { TransactionType } from '../supabase/types';

const BANK_ID_MAP: Record<string, string> = {
  '001': 'Banco do Brasil',
  '033': 'Santander',
  '104': 'Caixa Econômica Federal',
  '237': 'Bradesco',
  '260': 'Nubank',
  '077': 'Banco Inter',
  '341': 'Itaú Unibanco',
  '336': 'C6 Bank',
  '290': 'PagBank',
  '380': 'PicPay',
};

/**
 * Normaliza data do padrão OFX YYYYMMDD[HHMMSS] para YYYY-MM-DD
 */
function parseOfxDate(dateStr: string): string {
  if (!dateStr || dateStr.length < 8) {
    return new Date().toISOString().split('T')[0];
  }
  const clean = dateStr.replace(/[^0-9]/g, '');
  const year = clean.substring(0, 4);
  const month = clean.substring(4, 6);
  const day = clean.substring(6, 8);
  return `${year}-${month}-${day}`;
}

/**
 * Cria um hash determinístico para evitar duplicatas em extratos OFX
 */
function generateOfxHash(fitId: string, date: string, amount: number, memo: string): string {
  const payload = `${fitId || ''}_${date}_${amount.toFixed(2)}_${memo.toLowerCase().trim()}`;
  let hash = 0;
  for (let i = 0; i < payload.length; i++) {
    const char = payload.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return `ofx_${Math.abs(hash).toString(36)}`;
}

/**
 * Detecta automaticamente o nome da instituição bancária no OFX
 */
export function extractBankInfoFromOfx(content: string): { name: string; org: string } {
  const orgMatch = content.match(/<ORG>(.*?)(?:<\/ORG>|\r|\n)/i);
  const bankIdMatch = content.match(/<BANKID>(.*?)(?:<\/BANKID>|\r|\n)/i);

  const org = orgMatch ? orgMatch[1].trim() : '';
  const bankId = bankIdMatch ? bankIdMatch[1].trim() : '';

  let name = org;
  if (!name && bankId && BANK_ID_MAP[bankId]) {
    name = BANK_ID_MAP[bankId];
  } else if (!name) {
    name = 'Extrato Bancário OFX';
  }

  return { name, org };
}

/**
 * Parser de arquivos OFX (SGML / XML universal bancário brasileiro)
 */
export function parseOFX(content: string, existingHashes: Set<string> = new Set()): ParseNubankResult {
  try {
    if (!content || !content.includes('<STMTTRN>')) {
      return {
        formatDetected: 'unknown',
        totalFound: 0,
        newCount: 0,
        duplicateCount: 0,
        items: [],
        error: 'Arquivo OFX inválido ou sem bloco de transações (<STMTTRN>).'
      };
    }

    const bankInfo = extractBankInfoFromOfx(content);

    // Divide em blocos <STMTTRN>
    const trnBlocks = content.split(/<STMTTRN>/i).slice(1);

    const items: ParsedNubankItem[] = [];
    let duplicateCount = 0;
    let newCount = 0;

    for (let index = 0; index < trnBlocks.length; index++) {
      const block = trnBlocks[index];

      // Tags podem ser SGML sem fechamento (terminam com quebra de linha ou próxima tag)
      const trnTypeMatch = block.match(/<TRNTYPE>(.*?)(?:<\/TRNTYPE>|\r|\n|<)/i);
      const dtPostedMatch = block.match(/<DTPOSTED>(.*?)(?:<\/DTPOSTED>|\r|\n|<)/i);
      const trnAmtMatch = block.match(/<TRNAMT>(.*?)(?:<\/TRNAMT>|\r|\n|<)/i);
      const fitIdMatch = block.match(/<FITID>(.*?)(?:<\/FITID>|\r|\n|<)/i);
      const memoMatch = block.match(/<MEMO>(.*?)(?:<\/MEMO>|\r|\n|<)/i);
      const nameMatch = block.match(/<NAME>(.*?)(?:<\/NAME>|\r|\n|<)/i);

      const trnType = trnTypeMatch ? trnTypeMatch[1].trim().toUpperCase() : 'OTHER';
      const rawDate = dtPostedMatch ? dtPostedMatch[1].trim() : '';
      const rawAmt = trnAmtMatch ? trnAmtMatch[1].trim().replace(',', '.') : '0';
      const fitId = fitIdMatch ? fitIdMatch[1].trim() : '';
      const rawMemo = memoMatch ? memoMatch[1].trim() : (nameMatch ? nameMatch[1].trim() : 'Transação Bancária');

      const numericAmt = parseFloat(rawAmt);
      if (isNaN(numericAmt)) continue;

      const date = parseOfxDate(rawDate);
      const cleanTitle = sanitizeText(rawMemo);
      const absAmount = Math.abs(numericAmt);

      // Tipo: negativo no OFX = saída/despesa, positivo = entrada/receita
      const isExpense = numericAmt < 0 || trnType === 'DEBIT';
      const type: TransactionType = isExpense ? 'expense' : 'income';

      // Categorização preditiva
      let predictedCategory = isExpense ? 'Outros' : 'Outras Receitas';
      const lower = cleanTitle.toLowerCase();

      for (const rule of DEFAULT_CATEGORIZATION_RULES) {
        if (rule.type !== type) continue;
        const matched = rule.keywords.some(kw => lower.includes(kw));
        if (matched) {
          predictedCategory = rule.categoryName;
          break;
        }
      }

      // Hash de unicidade
      const hash = generateOfxHash(fitId, date, absAmount, cleanTitle);
      const isDuplicate = existingHashes.has(hash);
      if (isDuplicate) {
        duplicateCount++;
      } else {
        newCount++;
      }

      items.push({
        id: `ofx_${index}_${Date.now()}`,
        date,
        rawDate,
        originalTitle: rawMemo,
        cleanTitle: `${cleanTitle} (${bankInfo.name})`,
        amount: absAmount,
        type,
        categoryName: predictedCategory,
        isInstallment: false,
        isPaymentOrReversal: false,
        hash,
        isDuplicate,
        selected: !isDuplicate
      });
    }

    return {
      formatDetected: 'account_statement',
      totalFound: items.length,
      newCount,
      duplicateCount,
      items
    };
  } catch (err: any) {
    return {
      formatDetected: 'unknown',
      totalFound: 0,
      newCount: 0,
      duplicateCount: 0,
      items: [],
      error: `Erro ao processar arquivo OFX: ${err?.message || 'Formato desconhecido'}`
    };
  }
}
