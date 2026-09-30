import { getDaysInMonth } from 'date-fns';

export interface BurnRateResult {
  totalBudget: number;
  totalSpent: number;
  remainingBudget: number;
  daysInMonth: number;
  dayOfMonth: number;
  daysRemaining: number;
  dailySafeSpend: number;       // Quanto pode gastar por dia daqui até o fim do mês
  actualDailySpend: number;     // Média gasta por dia até hoje
  pacePercentage: number;       // (actual / safe) * 100
  status: 'safe' | 'warning' | 'danger';
  statusMessage: string;
  projectedMonthEndExpense: number;
}

export function calculateBurnRate(
  totalBudget: number,
  totalSpent: number,
  referenceDate: Date = new Date()
): BurnRateResult {
  const daysInMonth = getDaysInMonth(referenceDate);
  const dayOfMonth = Math.max(1, referenceDate.getDate());
  const daysRemaining = Math.max(1, daysInMonth - dayOfMonth + 1);

  const safeTotalBudget = Math.max(0, isFinite(totalBudget) ? totalBudget : 0);
  const safeTotalSpent = Math.max(0, isFinite(totalSpent) ? totalSpent : 0);
  const remainingBudget = Math.max(0, safeTotalBudget - safeTotalSpent);
  
  // Limite diário seguro para os dias restantes
  const rawDailySafe = safeTotalBudget > 0 ? remainingBudget / daysRemaining : 0;
  const dailySafeSpend = isFinite(rawDailySafe) ? Math.max(0, rawDailySafe) : 0;
  
  // Ritmo real gasto até agora
  const rawActualDaily = safeTotalSpent / dayOfMonth;
  const actualDailySpend = isFinite(rawActualDaily) ? Math.max(0, rawActualDaily) : 0;

  // Projeção de gastos no final do mês mantendo o ritmo atual
  const rawProjected = actualDailySpend * daysInMonth;
  const projectedMonthEndExpense = isFinite(rawProjected) ? Math.max(0, rawProjected) : 0;

  // Índice de ritmo: se 100%, o usuário está gastando exatamente no ritmo do orçamento
  const expectedPaceSpent = (safeTotalBudget / daysInMonth) * dayOfMonth;
  const rawPace = expectedPaceSpent > 0 ? (safeTotalSpent / expectedPaceSpent) * 100 : 0;
  const pacePercentage = isFinite(rawPace) ? Math.max(0, rawPace) : 0;

  let status: 'safe' | 'warning' | 'danger' = 'safe';
  let statusMessage = 'Ritmo excelente. Gastos dentro do planejado para o mês.';

  if (safeTotalSpent > safeTotalBudget && safeTotalBudget > 0) {
    status = 'danger';
    statusMessage = 'Orçamento estourado! Limite mensal já foi ultrapassado.';
  } else if (pacePercentage > 115) {
    status = 'danger';
    statusMessage = 'Atenção crítica: seu ritmo diário está bem acima do limite seguro.';
  } else if (pacePercentage > 95) {
    status = 'warning';
    statusMessage = 'Atenção moderada: você está no limite do orçamento para os dias restantes.';
  }

  return {
    totalBudget: safeTotalBudget,
    totalSpent: safeTotalSpent,
    remainingBudget,
    daysInMonth,
    dayOfMonth,
    daysRemaining,
    dailySafeSpend,
    actualDailySpend,
    pacePercentage,
    status,
    statusMessage,
    projectedMonthEndExpense
  };
}
