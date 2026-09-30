'use client';

import React from 'react';
import { 
  ShieldCheck, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Info, 
  Sparkles,
  ArrowUpRight,
  HelpCircle
} from 'lucide-react';
import { Transaction, AccountAndCard, FixedExpense } from '@/lib/supabase/types';
import { usePrivacy } from '@/components/providers/privacy-provider';

interface HealthScoreCardProps {
  transactions: Transaction[];
  accounts: AccountAndCard[];
  fixedExpenses: FixedExpense[];
  baseIncome?: number;
  selectedMonth?: string;
}

export function HealthScoreCard({
  transactions,
  accounts,
  fixedExpenses,
  baseIncome = 0,
  selectedMonth
}: HealthScoreCardProps) {
  const { formatMoney } = usePrivacy();

  // 1. Cálculos de Renda e Despesas do período
  const currentMonthKey = selectedMonth || new Date().toISOString().substring(0, 7);
  const monthTransactions = transactions.filter(t => t.date.startsWith(currentMonthKey));

  const monthIncome = monthTransactions
    .filter(t => t.type === 'income' && t.status === 'completed')
    .reduce((acc, t) => acc + Number(t.amount), 0) || (baseIncome > 0 ? baseIncome : 0);

  const monthExpense = monthTransactions
    .filter(t => t.type === 'expense' && t.status === 'completed')
    .reduce((acc, t) => acc + Number(t.amount), 0);

  const totalFixed = fixedExpenses.reduce((acc, f) => acc + Number(f.amount), 0);

  // Saldo líquido em contas correntes / poupança / investimentos
  const totalLiquidBalance = accounts
    .filter(a => a.type !== 'credit_card')
    .reduce((acc, a) => acc + Number(a.balance), 0);

  // Saldo devedor em faturas de cartão de crédito
  const creditCards = accounts.filter(a => a.type === 'credit_card');
  const totalCreditDebt = creditCards.reduce((acc, a) => acc + Math.max(0, -Number(a.balance)), 0);
  const totalCreditLimit = creditCards.reduce((acc, a) => acc + Number(a.credit_limit || 0), 0);

  // Média estimada de gastos mensais
  const avgMonthlyExpense = Math.max(monthExpense, totalFixed, 1000);

  // ==========================================
  // FATORES DO SCORE (TOTAL: 100 PONTOS)
  // ==========================================

  // Fator 1: Taxa de Poupança (Max 30 pts)
  const savingsRate = monthIncome > 0 ? Math.max(0, ((monthIncome - monthExpense) / monthIncome) * 100) : 0;
  let savingsPoints = 0;
  if (savingsRate >= 25) savingsPoints = 30;
  else if (savingsRate >= 15) savingsPoints = 22;
  else if (savingsRate >= 5) savingsPoints = 14;
  else if (savingsRate > 0) savingsPoints = 8;
  else savingsPoints = 0;

  // Fator 2: Comprometimento de Renda Fixa (Max 25 pts)
  const fixedRatio = monthIncome > 0 ? (totalFixed / monthIncome) * 100 : (totalFixed > 0 ? 80 : 40);
  let fixedPoints = 0;
  if (fixedRatio <= 45) fixedPoints = 25;
  else if (fixedRatio <= 55) fixedPoints = 20;
  else if (fixedRatio <= 70) fixedPoints = 12;
  else fixedPoints = 4;

  // Fator 3: Reserva de Emergência em Meses (Max 25 pts)
  const emergencyMonths = avgMonthlyExpense > 0 ? totalLiquidBalance / avgMonthlyExpense : 0;
  let emergencyPoints = 0;
  if (emergencyMonths >= 6) emergencyPoints = 25;
  else if (emergencyMonths >= 3) emergencyPoints = 20;
  else if (emergencyMonths >= 1) emergencyPoints = 12;
  else if (emergencyMonths > 0.3) emergencyPoints = 6;
  else emergencyPoints = 2;

  // Fator 4: Limite de Cartão e Dívidas (Max 20 pts)
  const creditUsageRatio = totalCreditLimit > 0 ? (totalCreditDebt / totalCreditLimit) * 100 : 0;
  let creditPoints = 0;
  if (creditUsageRatio <= 30) creditPoints = 20;
  else if (creditUsageRatio <= 60) creditPoints = 14;
  else if (creditUsageRatio <= 85) creditPoints = 8;
  else creditPoints = 2;

  const totalScore = Math.min(100, Math.round(savingsPoints + fixedPoints + emergencyPoints + creditPoints));

  // Diagnóstico e Classificação
  let tier = {
    label: 'Excelente',
    color: 'text-emerald-400',
    bgColor: 'bg-emerald-500/10',
    borderColor: 'border-emerald-500/30',
    ringColor: '#10b981',
    description: 'Sua gestão financeira está altamente resiliente, equilibrada e com boa capacidade de investimento.'
  };

  if (totalScore < 50) {
    tier = {
      label: 'Crítico',
      color: 'text-rose-400',
      bgColor: 'bg-rose-500/10',
      borderColor: 'border-rose-500/30',
      ringColor: '#f43f5e',
      description: 'Atenção imediata: gastos superando a renda ou reserva insuficiente. Priorize cortar despesas não essenciais.'
    };
  } else if (totalScore < 70) {
    tier = {
      label: 'Em Atenção',
      color: 'text-amber-400',
      bgColor: 'bg-amber-500/10',
      borderColor: 'border-amber-500/30',
      ringColor: '#f59e0b',
      description: 'Finanças sob controle mas vulneráveis a imprevistos. Foque em fortalecer sua reserva de segurança.'
    };
  } else if (totalScore < 85) {
    tier = {
      label: 'Equilibrado',
      color: 'text-cyan-400',
      bgColor: 'bg-cyan-500/10',
      borderColor: 'border-cyan-500/30',
      ringColor: '#06b6d4',
      description: 'Bom equilíbrio financeiro. O próximo passo é aumentar a taxa mensal de aportes e investimentos.'
    };
  }

  // Gera dicas práticas personalizadas
  const recommendations: string[] = [];
  if (emergencyMonths < 3) {
    recommendations.push(`Sua reserva cobre cerca de ${emergencyMonths.toFixed(1)} meses. Construa uma meta para atingir 3 a 6 meses de segurança.`);
  }
  if (fixedRatio > 50) {
    recommendations.push(`Seus custos fixos comprometem ${fixedRatio.toFixed(0)}% da renda. O ideal recomendado por especialistas é até 50%.`);
  }
  if (savingsRate < 15) {
    recommendations.push(`Sua taxa de poupança atual é de ${savingsRate.toFixed(0)}%. Tente poupar logo no primeiro dia do ciclo financeiro.`);
  }
  if (creditUsageRatio > 50) {
    recommendations.push(`Você está usando ${creditUsageRatio.toFixed(0)}% do seu limite de crédito. Evite ultrapassar 30% para proteger seu score.`);
  }
  if (recommendations.length === 0) {
    recommendations.push('Parabéns! Suas finanças estão no caminho certo. Continue aportando em suas metas de médio e longo prazo.');
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/60 backdrop-blur-md p-5 sm:p-6 shadow-sm relative overflow-hidden">
      {/* Background Subtle Gradient */}
      <div 
        className="absolute -top-24 -right-24 w-60 h-60 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: tier.ringColor }}
      />

      <div className="flex flex-col gap-5">
        {/* Top Section: Score Radial & Status */}
        <div className="flex items-center gap-4 sm:gap-5">
          <div className="relative w-20 h-20 sm:w-24 sm:h-24 flex items-center justify-center shrink-0">
            {/* SVG Ring Progress */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke="currentColor"
                strokeWidth="8"
                className="text-secondary/60 fill-none"
              />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={tier.ringColor}
                strokeWidth="8"
                strokeDasharray={`${(totalScore / 100) * 251.2} 251.2`}
                strokeLinecap="round"
                className="fill-none transition-all duration-1000 ease-out"
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-xl sm:text-2xl font-extrabold text-foreground tracking-tight tabular-nums">
                {totalScore}
              </span>
              <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">
                de 100
              </span>
            </div>
          </div>

          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-muted-foreground">Saúde</span>
              <span className={`px-2 py-0.2 rounded-full text-[11px] font-bold border ${tier.bgColor} ${tier.color} ${tier.borderColor}`}>
                {tier.label}
              </span>
            </div>
            <h3 className="text-sm sm:text-base font-bold text-foreground truncate">
              Diagnóstico do Seu Bolso
            </h3>
            <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
              {tier.description}
            </p>
          </div>
        </div>

        {/* Indicator Mini-Bars (Grid 2x2 adaptável) */}
        <div className="grid grid-cols-2 gap-2.5 w-full">
          {/* Poupança */}
          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 space-y-1 min-w-0">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate">Poupança</span>
              <span className="font-semibold text-foreground tabular-nums">{savingsRate.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-emerald-400 h-full rounded-full transition-all duration-700" 
                style={{ width: `${Math.min(100, (savingsPoints / 30) * 100)}%` }} 
              />
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {savingsRate >= 20 ? 'Excelente' : 'Aumentar'}
            </span>
          </div>

          {/* Gastos Fixos */}
          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 space-y-1 min-w-0">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate">Custos Fixos</span>
              <span className="font-semibold text-foreground tabular-nums">{fixedRatio.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${fixedRatio <= 50 ? 'bg-emerald-400' : fixedRatio <= 70 ? 'bg-amber-400' : 'bg-rose-400'}`} 
                style={{ width: `${Math.min(100, (fixedPoints / 25) * 100)}%` }} 
              />
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {fixedRatio <= 50 ? 'Meta ideal' : 'Controlar'}
            </span>
          </div>

          {/* Reserva de Emergência */}
          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 space-y-1 min-w-0">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate">Reserva</span>
              <span className="font-semibold text-foreground tabular-nums">{emergencyMonths.toFixed(1)}m</span>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div 
                className="bg-cyan-400 h-full rounded-full transition-all duration-700" 
                style={{ width: `${Math.min(100, (emergencyPoints / 25) * 100)}%` }} 
              />
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {emergencyMonths >= 6 ? 'Segura (6m+)' : `${emergencyMonths.toFixed(1)} meses`}
            </span>
          </div>

          {/* Cartões e Dívidas */}
          <div className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 space-y-1 min-w-0">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground truncate">Cartão</span>
              <span className="font-semibold text-foreground tabular-nums">{creditUsageRatio.toFixed(0)}%</span>
            </div>
            <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-700 ${creditUsageRatio <= 30 ? 'bg-emerald-400' : creditUsageRatio <= 60 ? 'bg-amber-400' : 'bg-rose-400'}`} 
                style={{ width: `${Math.min(100, (creditPoints / 20) * 100)}%` }} 
              />
            </div>
            <span className="text-[10px] text-muted-foreground block truncate">
              {creditUsageRatio <= 30 ? 'Saudável' : 'Atenção'}
            </span>
          </div>
        </div>
      </div>

      {/* Practical Action Recommendation */}
      <div className="mt-4 pt-3.5 border-t border-border/60 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
        <div className="flex items-start sm:items-center gap-2 text-muted-foreground">
          <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5 sm:mt-0" />
          <span className="text-[11px] sm:text-xs">
            <strong className="text-foreground">Recomendação inteligente:</strong> {recommendations[0]}
          </span>
        </div>
        <div className="text-[10px] text-muted-foreground shrink-0">
          Atualizado em tempo real com suas movimentações
        </div>
      </div>
    </div>
  );
}
