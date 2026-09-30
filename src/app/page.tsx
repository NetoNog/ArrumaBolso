'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { CashFlowProjectionChart } from '@/components/dashboard/cash-flow-projection-chart';
import { CategoryBreakdownChart } from '@/components/dashboard/category-breakdown-chart';
import { HealthScoreCard } from '@/components/dashboard/health-score-card';
import { AiFinancialInsights } from '@/components/dashboard/ai-financial-insights';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import { usePeriod } from '@/components/providers/period-provider';
import { FinancialService } from '@/lib/services/financial-service';
import { 
  useProfile, 
  useAccounts, 
  useCategories, 
  useTransactions, 
  useBudgets, 
  useGoals,
  useFixedExpenses,
  useAddTransaction,
  useToggleTransactionStatus 
} from '@/hooks/use-financial';
import { calculateTwelveMonthProjection } from '@/lib/financial/projection-engine';
import { toCents, fromCents, parseLocalDate, formatCurrency, formatDateBR } from '@/lib/financial/formatters';
import { 
  Wallet, 
  TrendingUp, 
  PiggyBank, 
  PieChart as PieChartIcon, 
  Sparkles,
  ArrowRight,
  UploadCloud,
  Plus,
  Minus,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  Target,
  ChevronRight
} from 'lucide-react';
import Link from 'next/link';
import { format, subMonths, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';
import { usePrivacy } from '@/components/providers/privacy-provider';
import { TransactionType } from '@/lib/supabase/types';

export default function DashboardPage() {
  const router = useRouter();
  const { formatMoney } = usePrivacy();

  const { data: profile } = useProfile();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const { data: goals = [] } = useGoals();
  const { data: fixedExpenses = [] } = useFixedExpenses();
  const { data: budgets = [] } = useBudgets();

  const addTransactionMutation = useAddTransaction();
  const toggleStatusMutation = useToggleTransactionStatus();

  // Período Global Automático
  const { selectedMonth, setSelectedMonth } = usePeriod();
  
  // Modal de Transação Rápida
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'expense' | 'income' | 'investment'>('expense');

  const handleOpenModal = (type: 'expense' | 'income' | 'investment') => {
    setModalType(type);
    setIsModalOpen(true);
  };

  // Cálculos do Mês Selecionado
  const consolidatedBalance = fromCents(
    accounts.reduce((sum, a) => sum + toCents(a.balance), 0)
  );

  const currentMonthTransactions = transactions.filter(t => t.date.startsWith(selectedMonth));
  
  // Receitas
  const currentMonthIncome = fromCents(
    currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + toCents(t.amount), 0)
  );
  const receivedIncome = fromCents(
    currentMonthTransactions
      .filter(t => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + toCents(t.amount), 0)
  );
  const pendingIncome = fromCents(
    currentMonthTransactions
      .filter(t => t.type === 'income' && t.status === 'pending')
      .reduce((sum, t) => sum + toCents(t.amount), 0)
  );

  // Despesas
  const currentMonthExpense = fromCents(
    currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + toCents(t.amount), 0)
  );
  const paidExpense = fromCents(
    currentMonthTransactions
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + toCents(t.amount), 0)
  );
  const pendingExpense = fromCents(
    currentMonthTransactions
      .filter(t => t.type === 'expense' && t.status === 'pending')
      .reduce((sum, t) => sum + toCents(t.amount), 0)
  );

  // Economia / Saldo Líquido Previsto do Mês
  const monthNetBalance = currentMonthIncome - currentMonthExpense;
  const rawSavingsRate = currentMonthIncome > 0 ? (monthNetBalance / currentMonthIncome) * 100 : 0;
  const savingsRate = isFinite(rawSavingsRate) ? Math.max(0, rawSavingsRate) : 0;

  // Próximos Vencimentos e Alertas Inteligentes
  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const in3DaysStr = format(addDays(new Date(), 3), 'yyyy-MM-dd');

  const overdueBills = transactions.filter(
    t => t.type === 'expense' && t.status === 'pending' && t.date < todayStr
  );
  const totalOverdue = fromCents(overdueBills.reduce((s, t) => s + toCents(t.amount), 0));

  const dueSoonBills = transactions.filter(
    t => t.type === 'expense' && t.status === 'pending' && t.date >= todayStr && t.date <= in3DaysStr
  );
  const totalDueSoon = fromCents(dueSoonBills.reduce((s, t) => s + toCents(t.amount), 0));

  // Próximos Vencimentos deste mês
  const upcomingBills = currentMonthTransactions
    .filter(t => t.type === 'expense' && t.status === 'pending')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 5);

  // Últimas Transações recentes
  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5);

  // Breakdown por Categoria (Gráfico Donut)
  const categorySpendMap = new Map<string, number>();
  currentMonthTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const cur = categorySpendMap.get(t.category_name) || 0;
      categorySpendMap.set(t.category_name, cur + toCents(t.amount));
    });

  const finalCategoryBreakdown = Array.from(categorySpendMap.entries()).map(([name, amountInCents]) => {
    const catObj = categories.find(c => c.name === name);
    const amount = fromCents(amountInCents);
    const rawPct = currentMonthExpense > 0 ? (amount / currentMonthExpense) * 100 : 0;
    return {
      name,
      amount,
      color: catObj?.color || '#818cf8',
      percentage: isFinite(rawPct) ? Math.max(0, rawPct) : 0
    };
  });

  // Projeção de 12 Meses
  const projection = calculateTwelveMonthProjection(
    consolidatedBalance,
    transactions,
    Number(profile?.base_monthly_income || 0),
    new Date()
  );

  const handleQuickPay = async (id: string) => {
    try {
      await toggleStatusMutation.mutateAsync(id);
      toast.success('Despesa marcada como paga!', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await toggleStatusMutation.mutateAsync(id);
          }
        }
      });
    } catch {
      toast.error('Erro ao marcar como paga.');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar accounts={accounts} />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader 
          selectedMonth={selectedMonth} 
          onMonthChange={setSelectedMonth}
          onOpenNewTransaction={() => handleOpenModal('expense')}
        />

        <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28 md:pb-12">
          {/* Top Welcome & Quick Actions Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Dashboard Executivo
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Visão consolidada e projeção inteligente do seu patrimônio e despesas.
              </p>
            </div>

            {/* Quick Action Buttons - Desktop / Tablet */}
            <div className="hidden sm:flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                onClick={() => handleOpenModal('income')}
                className="interactive-tap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm"
              >
                <Plus className="w-4 h-4" />
                Nova Receita
              </button>
              <button
                onClick={() => handleOpenModal('expense')}
                className="interactive-tap inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm"
              >
                <Minus className="w-4 h-4" />
                Nova Despesa
              </button>
              <Link
                href="/import"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/70 transition-colors"
              >
                <UploadCloud className="w-3.5 h-3.5 text-muted-foreground" />
                Importar CSV
              </Link>
            </div>
          </div>

          {/* Smart Due Date Alerts Banner */}
          {overdueBills.length > 0 && (
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-rose-500/10 border border-rose-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-rose-400">
                    Atenção: Você tem {overdueBills.length} conta{overdueBills.length > 1 ? 's' : ''} em atraso totalizando <span className="tabular-nums">{formatMoney(totalOverdue)}</span>!
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                    Regularize suas pendências para evitar cobranças de juros e multas.
                  </p>
                </div>
              </div>
              <Link
                href="/expenses"
                className="w-full sm:w-auto text-center px-3.5 py-1.5 rounded-xl bg-rose-500 hover:bg-rose-600 text-white text-xs font-bold transition-all shadow-sm shrink-0"
              >
                Regularizar Agora
              </Link>
            </div>
          )}

          {dueSoonBills.length > 0 && overdueBills.length === 0 && (
            <div className="p-3.5 sm:p-4 rounded-xl sm:rounded-2xl bg-amber-500/10 border border-amber-500/25 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0">
                  <Clock className="w-4 h-4 sm:w-5 sm:h-5" />
                </div>
                <div>
                  <h4 className="text-xs sm:text-sm font-bold text-amber-400">
                    Contas a vencer: {dueSoonBills.length} conta{dueSoonBills.length > 1 ? 's' : ''} vencendo nos próximos 3 dias (<span className="tabular-nums">{formatMoney(totalDueSoon)}</span>)
                  </h4>
                  <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-0.5">
                    Programe seus pagamentos para manter a saúde do seu bolso em dia.
                  </p>
                </div>
              </div>
              <Link
                href="/fixed-debts"
                className="w-full sm:w-auto text-center px-3.5 py-1.5 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/30 text-xs font-bold transition-all shrink-0"
              >
                Ver Vencimentos
              </Link>
            </div>
          )}

          {/* 4 Executive KPI Cards (Grid 2x2 no mobile, 4 colunas no desktop) */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 sm:gap-4">
            {/* 1. Saldo Consolidado */}
            <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover-glow hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground line-clamp-1">Saldo Total</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2 text-base sm:text-2xl font-bold tracking-tight text-foreground tabular-nums truncate">
                {formatMoney(consolidatedBalance)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 line-clamp-1">
                {accounts.length} conta{accounts.length === 1 ? '' : 's'}/cartões
              </p>
            </div>

            {/* 2. Receitas do Mês */}
            <Link 
              href="/incomes"
              className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-emerald-500/40 transition-all flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground line-clamp-1">Receitas</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
                  <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2 text-base sm:text-2xl font-bold tracking-tight text-emerald-400 tabular-nums truncate">
                {formatMoney(currentMonthIncome)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] truncate">
                <span className="text-emerald-400 font-semibold tabular-nums">
                  {formatMoney(receivedIncome)}
                </span>
                {pendingIncome > 0 && (
                  <span className="text-amber-400 hidden xs:inline tabular-nums">
                    • {formatMoney(pendingIncome)}
                  </span>
                )}
              </div>
            </Link>

            {/* 3. Despesas do Mês */}
            <Link 
              href="/expenses"
              className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-rose-500/40 transition-all flex flex-col justify-between cursor-pointer"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground line-clamp-1">Despesas</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0">
                  <ArrowDownRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className="mt-2 text-base sm:text-2xl font-bold tracking-tight text-rose-400 tabular-nums truncate">
                {formatMoney(currentMonthExpense)}
              </div>
              <div className="flex items-center gap-1.5 mt-1 text-[10px] sm:text-[11px] truncate">
                <span className="text-muted-foreground tabular-nums">
                  Pago: {formatMoney(paidExpense)}
                </span>
              </div>
            </Link>

            {/* 4. Economia / Saldo Previsto */}
            <div className="p-3.5 sm:p-5 rounded-xl sm:rounded-2xl bg-card border border-border/80 shadow-xs relative overflow-hidden group hover:border-primary/40 transition-all flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground line-clamp-1">Economia</span>
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-lg sm:rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                  <PiggyBank className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                </div>
              </div>
              <div className={`mt-2 text-base sm:text-2xl font-bold tracking-tight tabular-nums truncate ${monthNetBalance >= 0 ? 'text-foreground' : 'text-rose-400'}`}>
                {formatMoney(monthNetBalance)}
              </div>
              <p className="text-[10px] sm:text-[11px] text-muted-foreground mt-1 truncate">
                {savingsRate > 0 ? `${savingsRate.toFixed(0)}% poupado` : 'Atenção ao saldo'}
              </p>
            </div>
          </div>

          {/* Inteligência Financeira: Previsão de Fechamento, Monitor de Tetos & Limites, Assinaturas */}
          <AiFinancialInsights
            transactions={transactions}
            fixedExpenses={fixedExpenses}
            categories={categories}
            budgets={budgets}
            selectedMonth={selectedMonth}
            baseIncome={Number(profile?.base_monthly_income || 0)}
          />

          {/* Executive 2-Column Responsive Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Coluna Principal: Fluxo Projetado & Transações Recentes & Metas (8 Colunas em telas grandes) */}
            <div className="lg:col-span-7 xl:col-span-8 space-y-6">
              {/* 1. Projeção de Fluxo de Caixa (12 Meses) */}
              <CashFlowProjectionChart 
                projection={projection} 
              />

              {/* 2. Transações Recentes */}
              <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Wallet className="w-4 h-4" />
                    </div>
                    <div>
                      <h3 className="font-bold text-sm text-foreground">Últimas Transações</h3>
                      <p className="text-[11px] text-muted-foreground">Movimentações mais recentes do seu extrato</p>
                    </div>
                  </div>
                  <Link
                    href="/transactions"
                    className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                  >
                    Ver todas <ChevronRight className="w-3.5 h-3.5" />
                  </Link>
                </div>

                {recentTransactions.length === 0 ? (
                  <div className="p-8 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                    Nenhuma movimentação registrada. Comece adicionando uma receita ou despesa.
                  </div>
                ) : (
                  <div className="divide-y divide-border/60">
                    {recentTransactions.map((tx) => {
                      const isIncome = tx.type === 'income';
                      const isCompleted = tx.status === 'completed';
                      return (
                        <div
                          key={tx.id}
                          className="py-3 flex items-center justify-between gap-3 hover:bg-secondary/20 px-2 rounded-xl transition-colors"
                        >
                          <div className="min-w-0 flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>
                            <div className="min-w-0">
                              <span className="font-semibold text-xs text-foreground truncate block">
                                {tx.description}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <span>{tx.category_name}</span>
                                <span>•</span>
                                <span>{formatDateBR(tx.date)}</span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex items-center gap-3">
                            <span className={`font-bold text-xs tabular-nums ${
                              isIncome ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {isIncome ? '+' : '-'}{formatMoney(Number(tx.amount))}
                            </span>
                            <button
                              onClick={() => handleQuickPay(tx.id)}
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25'
                                  : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25'
                              }`}
                              title="Clique para alternar situação"
                            >
                              {isCompleted ? 'Pago' : 'Pendente'}
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 3. Metas Financeiras */}
              <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Target className="w-4 h-4" />
                      </div>
                      <h3 className="font-bold text-sm text-foreground">Metas Financeiras</h3>
                    </div>
                    <Link
                      href="/goals"
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      Gerenciar <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {goals.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                      Nenhuma meta criada ainda. Defina seus objetivos de reserva ou viagem.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                      {goals.slice(0, 4).map((g) => {
                        const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
                        return (
                          <div key={g.id} className="p-3 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-semibold text-foreground truncate">{g.title}</span>
                              <span className="text-[11px] font-bold text-primary tabular-nums">
                                {pct.toFixed(0)}%
                              </span>
                            </div>
                            <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full bg-primary rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, pct)}%` }}
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                              <span>{formatCurrency(Number(g.current_amount))}</span>
                              <span>de {formatCurrency(Number(g.target_amount))}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="mt-4 pt-3 border-t border-border/60">
                  <Link
                    href="/goals"
                    className="w-full py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Nova Meta Financeira
                  </Link>
                </div>
              </div>
            </div>

            {/* Coluna Lateral: Score de Saúde, Vencimentos, Categorias e Insights (4 Colunas) */}
            <div className="lg:col-span-5 xl:col-span-4 space-y-6">
              {/* 1. Score de Saúde Financeira */}
              <HealthScoreCard
                transactions={transactions}
                accounts={accounts}
                fixedExpenses={fixedExpenses}
                baseIncome={Number(profile?.base_monthly_income || 0)}
                selectedMonth={selectedMonth}
              />

              {/* 2. Próximos Vencimentos com 1-Click Pay */}
              {upcomingBills.length > 0 && (
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-bold text-sm text-foreground">
                        A Vencer no Mês
                      </h3>
                    </div>
                    <Link
                      href="/expenses"
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      Ver todas <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  <div className="space-y-2.5">
                    {upcomingBills.map((bill) => (
                      <div
                        key={bill.id}
                        className="p-3 rounded-xl bg-secondary/30 border border-border/70 flex items-center justify-between hover:bg-secondary/50 transition-colors"
                      >
                        <div className="min-w-0 pr-2">
                          <span className="font-bold text-xs text-foreground truncate block">{bill.description}</span>
                          <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                            <span className="truncate">{bill.category_name}</span>
                            <span>•</span>
                            <span className="text-amber-500 dark:text-amber-400 font-semibold whitespace-nowrap">
                              Dia {bill.date.substring(8, 10)}
                            </span>
                          </div>
                        </div>

                        <div className="text-right flex items-center gap-2 shrink-0">
                          <span className="font-bold text-xs text-rose-400 tabular-nums">
                            {formatMoney(Number(bill.amount))}
                          </span>
                          <button
                            onClick={() => handleQuickPay(bill.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-semibold transition-all active:scale-95 shadow-xs"
                            title="Marcar como Pago"
                          >
                            Pagar
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 3. Distribuição de Gastos (Donut) */}
              <CategoryBreakdownChart 
                categories={finalCategoryBreakdown}
                totalExpense={currentMonthExpense}
              />

              {/* 4. Gastos Fixos & Dívidas Recorrentes */}
              <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                        <Repeat className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="font-bold text-sm text-foreground">Gastos Fixos</h3>
                    </div>
                    <Link
                      href="/fixed-debts"
                      className="text-xs text-primary font-semibold hover:underline flex items-center gap-1"
                    >
                      Detalhes <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>

                  {fixedExpenses.length === 0 ? (
                    <div className="p-4 text-center text-xs text-muted-foreground border border-dashed border-border/60 rounded-xl">
                      Nenhum gasto fixo cadastrado.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {fixedExpenses.slice(0, 3).map((f) => (
                        <div key={f.id} className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between text-xs">
                          <div>
                            <span className="font-semibold text-foreground block truncate">{f.name}</span>
                            <span className="text-[10px] text-muted-foreground">Vence dia {f.due_day}</span>
                          </div>
                          <span className="font-bold text-foreground tabular-nums">
                            {formatCurrency(Number(f.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="mt-3 pt-3 border-t border-border/60">
                  <Link
                    href="/fixed-debts"
                    className="w-full py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Organizar Gastos Fixos
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>

      <MobileBottomNav onOpenNewTransaction={(type) => handleOpenModal(type || 'expense')} />

      {/* Modal de Transação Rápida */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        categories={categories}
        accounts={accounts}
        initialType={modalType}
        onSave={async (tx, gen) => {
          await addTransactionMutation.mutateAsync({ tx, generateInstallments: gen });
        }}
      />
    </div>
  );
}
