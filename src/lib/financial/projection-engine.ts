import { addMonths, format, parseISO, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Transaction } from '../supabase/types';

export interface MonthProjection {
  monthKey: string;          // YYYY-MM
  label: string;             // Ex: "Out/24"
  fullLabel: string;         // Ex: "Outubro 2024"
  monthOffset: number;       // 0 = mês atual, 1 = próximo, etc.
  projectedIncome: number;
  fixedExpenses: number;
  installmentsExpenses: number;
  variableExpenses: number;
  totalExpenses: number;
  netSavings: number;
  projectedCumulativeBalance: number;
  compromisedPercentage: number; // (fixed + installments) / income * 100
}

export interface ProjectionSummary {
  months: MonthProjection[];
  twelveMonthsTotalIncome: number;
  twelveMonthsTotalExpenses: number;
  twelveMonthsNetSavings: number;
  finalProjectedBalance: number;
  lowestBalanceMonth: { label: string; balance: number };
  highestBalanceMonth: { label: string; balance: number };
}

export function calculateTwelveMonthProjection(
  currentBalance: number,
  transactions: Transaction[],
  baseMonthlyIncome: number = 0,
  referenceDate: Date = new Date()
): ProjectionSummary {
  const currentMonthStart = startOfMonth(referenceDate);
  const currentMonthKey = format(currentMonthStart, 'yyyy-MM');

  // 1. Despesas fixas recorrentes mensais reais (deduplicadas por mês recente ou por descrição)
  const recurringMap = new Map<string, number>();
  transactions
    .filter(t => t.is_recurring && t.type === 'expense')
    .forEach(t => {
      const descKey = t.description.toLowerCase().trim();
      // Mantém o valor mais recente para cada despesa recorrente
      if (!recurringMap.has(descKey) || (t.date && t.date.startsWith(currentMonthKey))) {
        recurringMap.set(descKey, Number(t.amount));
      }
    });

  const recurringExpenses = Array.from(recurringMap.values()).reduce((sum, val) => sum + val, 0);

  // 2. Média mensal real de gastos variáveis (dividido pelo número de meses distintos)
  const variableByMonth = new Map<string, number>();
  transactions
    .filter(t => !t.is_recurring && (!t.installment_total || t.installment_total <= 1) && t.type === 'expense')
    .forEach(t => {
      const mKey = t.date ? t.date.substring(0, 7) : currentMonthKey;
      const cur = variableByMonth.get(mKey) || 0;
      variableByMonth.set(mKey, cur + Number(t.amount));
    });

  const distinctMonthsCount = Math.max(1, variableByMonth.size);
  const totalVariableSum = Array.from(variableByMonth.values()).reduce((sum, val) => sum + val, 0);
  const estimatedVariableMonthly = totalVariableSum / distinctMonthsCount;

  // 3. Identificar compras parceladas pendentes (evitando duplicação de parcelas futuras já criadas)
  // Agrupa séries de parcelas por group_id ou por (descrição + valor)
  const installmentSeries = new Map<string, { amount: number; current: number; total: number; hasExplicitFutureRows: boolean }>();
  
  // Verifica se o banco já possui parcelas futuras gravadas com datas futuras
  const explicitFutureGroups = new Set<string>();
  transactions.forEach(t => {
    if (t.installment_group_id && t.date > currentMonthKey) {
      explicitFutureGroups.add(t.installment_group_id);
    }
  });

  transactions
    .filter(t => t.installment_current && t.installment_total && t.installment_total > 1 && t.type === 'expense')
    .forEach(t => {
      const seriesKey = t.installment_group_id || `${t.description.toLowerCase().replace(/\s*\(\d+\/\d+\)/, '').trim()}_${t.amount}`;
      const cur = t.installment_current || 1;
      const tot = t.installment_total || 1;
      const existing = installmentSeries.get(seriesKey);

      // Salva a maior parcela já registrada para a série
      if (!existing || cur > existing.current) {
        installmentSeries.set(seriesKey, {
          amount: Number(t.amount),
          current: cur,
          total: tot,
          hasExplicitFutureRows: t.installment_group_id ? explicitFutureGroups.has(t.installment_group_id) : false
        });
      }
    });

  const months: MonthProjection[] = [];
  let runningBalance = currentBalance;
  let lowestBal = { label: '', balance: Infinity };
  let highestBal = { label: '', balance: -Infinity };

  let totalIncomeAccum = 0;
  let totalExpensesAccum = 0;

  for (let offset = 0; offset < 12; offset++) {
    const targetMonthDate = addMonths(currentMonthStart, offset);
    const monthKey = format(targetMonthDate, 'yyyy-MM');
    const label = format(targetMonthDate, 'MMM/yy', { locale: ptBR });
    const fullLabel = format(targetMonthDate, 'MMMM yyyy', { locale: ptBR });

    // Renda projetada real
    const projectedIncome = baseMonthlyIncome;

    // Despesas Fixas reais
    const fixed = recurringExpenses;

    // Parcelas reais que incidem neste mês
    let installmentsThisMonth = 0;

    // A. Transações de parcelas explicitamente agendadas para este mês no banco
    const explicitForThisMonth = transactions
      .filter(t => t.type === 'expense' && t.date.startsWith(monthKey) && t.installment_total && t.installment_total > 1)
      .reduce((sum, t) => sum + Number(t.amount), 0);

    if (explicitForThisMonth > 0) {
      installmentsThisMonth += explicitForThisMonth;
    }

    // B. Projeção de parcelas futuras de itens sem registros explícitos (ex: importadas de fatura CSV)
    installmentSeries.forEach(series => {
      if (series.hasExplicitFutureRows) return; // Já contabilizado pelas linhas explícitas do banco
      const remainingInstallments = series.total - series.current;
      if (offset > 0 && offset <= remainingInstallments) {
        installmentsThisMonth += series.amount;
      }
    });

    // Gastos variáveis projetados (baseados na média mensal real)
    const variable = estimatedVariableMonthly;

    const totalExp = fixed + installmentsThisMonth + variable;
    const net = projectedIncome - totalExp;
    runningBalance += net;

    totalIncomeAccum += projectedIncome;
    totalExpensesAccum += totalExp;

    const compromised = projectedIncome > 0 
      ? ((fixed + installmentsThisMonth) / projectedIncome) * 100 
      : 0;

    const item: MonthProjection = {
      monthKey,
      label,
      fullLabel,
      monthOffset: offset,
      projectedIncome,
      fixedExpenses: fixed,
      installmentsExpenses: installmentsThisMonth,
      variableExpenses: variable,
      totalExpenses: totalExp,
      netSavings: net,
      projectedCumulativeBalance: runningBalance,
      compromisedPercentage: Math.min(100, isFinite(compromised) ? compromised : 0)
    };

    if (runningBalance < lowestBal.balance) {
      lowestBal = { label, balance: runningBalance };
    }
    if (runningBalance > highestBal.balance) {
      highestBal = { label, balance: runningBalance };
    }

    months.push(item);
  }

  return {
    months,
    twelveMonthsTotalIncome: totalIncomeAccum,
    twelveMonthsTotalExpenses: totalExpensesAccum,
    twelveMonthsNetSavings: totalIncomeAccum - totalExpensesAccum,
    finalProjectedBalance: runningBalance,
    lowestBalanceMonth: lowestBal.balance === Infinity ? { label: months[0]?.label || '', balance: 0 } : lowestBal,
    highestBalanceMonth: highestBal.balance === -Infinity ? { label: months[0]?.label || '', balance: 0 } : highestBal
  };
}
