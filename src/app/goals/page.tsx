'use client';

import React, { useState } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { 
  useGoals, 
  useAddGoal, 
  useUpdateGoal, 
  useDeleteGoal, 
  useAddGoalContribution,
  useAccounts 
} from '@/hooks/use-financial';
import { formatCurrency, formatPercent } from '@/lib/financial/formatters';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';
import { 
  Target, 
  Plus, 
  Sparkles, 
  TrendingUp, 
  Calendar, 
  CheckCircle2, 
  DollarSign, 
  Trash2, 
  Clock, 
  X, 
  ShieldCheck, 
  Plane, 
  Car, 
  Home, 
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivacy } from '@/components/providers/privacy-provider';

export default function GoalsPage() {
  const { data: goals = [], isLoading } = useGoals();
  const { data: accounts = [] } = useAccounts();
  const { formatMoney } = usePrivacy();

  const addGoalMutation = useAddGoal();
  const updateGoalMutation = useUpdateGoal();
  const deleteGoalMutation = useDeleteGoal();
  const addContributionMutation = useAddGoalContribution();

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [contributionModalGoal, setContributionModalGoal] = useState<any | null>(null);

  // Form de Nova Meta
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalMonthly, setGoalMonthly] = useState('');
  const [goalDate, setGoalDate] = useState('2026-12-31');
  const [goalIcon, setGoalIcon] = useState('target');
  const [goalColor, setGoalColor] = useState('#6366f1');

  // Form de Aporte
  const [contributionAmount, setContributionAmount] = useState('');
  const [contributionAccountId, setContributionAccountId] = useState('');

  // Cálculos Gerais de Metas
  const totalTargetAmount = goals.reduce((sum, g) => sum + Number(g.target_amount), 0);
  const totalAccumulated = goals.reduce((sum, g) => sum + Number(g.current_amount), 0);
  const overallProgress = totalTargetAmount > 0 ? (totalAccumulated / totalTargetAmount) * 100 : 0;
  const completedGoalsCount = goals.filter(g => g.is_completed || Number(g.current_amount) >= Number(g.target_amount)).length;

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseCurrency(goalTarget);
    const current = parseCurrency(goalCurrent);
    const monthly = parseCurrency(goalMonthly);

    if (!goalTitle.trim() || isNaN(target) || target <= 0) {
      toast.error('Informe um título e valor alvo válido.');
      return;
    }

    try {
      await addGoalMutation.mutateAsync({
        title: goalTitle.trim(),
        target_amount: target,
        current_amount: current,
        monthly_contribution: monthly,
        deadline_date: goalDate,
        icon: goalIcon,
        color: goalColor,
        is_completed: current >= target
      });
      toast.success('Meta financeira criada com sucesso!');
      setIsGoalModalOpen(false);
      setGoalTitle('');
      setGoalTarget('');
      setGoalCurrent('');
      setGoalMonthly('');
    } catch {
      toast.error('Erro ao criar meta.');
    }
  };

  const handleContributionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contributionModalGoal) return;
    const val = parseCurrency(contributionAmount);
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor de aporte válido.');
      return;
    }

    try {
      await addContributionMutation.mutateAsync({
        goalId: contributionModalGoal.id,
        amount: val,
        accountId: contributionAccountId || undefined
      });
      toast.success(`Aporte de ${formatCurrency(val)} adicionado com sucesso!`);
      setContributionModalGoal(null);
      setContributionAmount('');
    } catch {
      toast.error('Erro ao registrar aporte.');
    }
  };

  const handleDeleteGoal = async (goal: any) => {
    try {
      await deleteGoalMutation.mutateAsync(goal.id);
      toast.success(`Meta "${goal.title}" excluída.`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              const { id: _, created_at: __, ...rest } = goal;
              await addGoalMutation.mutateAsync(rest);
              toast.success('Meta restaurada com sucesso!');
            } catch {
              toast.error('Não foi possível restaurar a meta.');
            }
          },
        },
      });
    } catch {
      toast.error('Erro ao excluir meta.');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar accounts={accounts} />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />

        <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28 md:pb-12">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Target className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Metas Financeiras
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Defina objetivos de curto, médio e longo prazo e acompanhe o progresso de acumulação patrimonial.
              </p>
            </div>

            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all active:scale-[0.98] self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Nova Meta Financeira
            </button>
          </div>

          {/* KPI Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total Acumulado</span>
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                  <DollarSign className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-600 dark:text-emerald-400">
                {formatCurrency(totalAccumulated)}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                De um objetivo global de {formatCurrency(totalTargetAmount)}
              </p>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Progresso Global</span>
                <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                  <TrendingUp className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {overallProgress.toFixed(1)}%
              </div>
              <div className="w-full h-2 rounded-full bg-secondary overflow-hidden mt-2">
                <div 
                  className="h-full bg-primary rounded-full transition-all duration-500" 
                  style={{ width: `${Math.min(100, Math.max(0, overallProgress))}%` }}
                />
              </div>
            </div>

            <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden group">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Metas Concluídas</span>
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
              </div>
              <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                {completedGoalsCount} de {goals.length}
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {completedGoalsCount > 0 ? 'Parabéns pelos objetivos alcançados!' : 'Continue aportando mensalmente'}
              </p>
            </div>
          </div>

          {/* Goals Grid */}
          <div className="space-y-4">
            {goals.length === 0 ? (
              <div className="p-12 text-center rounded-2xl bg-card border border-border/70 flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                  <Target className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Nenhuma meta cadastrada</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Crie objetivos como Reserva de Emergência, Viagem de Férias ou Entrada de Imóvel para acompanhar sua evolução.
                </p>
                <button
                  onClick={() => setIsGoalModalOpen(true)}
                  className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                >
                  + Criar Primeira Meta
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {goals.map((goal) => {
                  const target = Number(goal.target_amount);
                  const current = Number(goal.current_amount);
                  const pct = target > 0 ? (current / target) * 100 : 0;
                  const isDone = current >= target;

                  return (
                    <div
                      key={goal.id}
                      className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between group"
                    >
                      <div>
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2.5">
                            <div 
                              className="w-9 h-9 rounded-xl flex items-center justify-center text-white font-bold"
                              style={{ backgroundColor: goal.color || '#6366f1' }}
                            >
                              <Target className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{goal.title}</h4>
                              {goal.deadline_date && (
                                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                                  <Calendar className="w-3 h-3" />
                                  Prazo: {goal.deadline_date.split('-').reverse().join('/')}
                                </span>
                              )}
                            </div>
                          </div>
                          {isDone ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                              <CheckCircle2 className="w-3 h-3" />
                              Concluída
                            </span>
                          ) : (
                            <span className="text-[11px] font-bold text-primary">
                              {pct.toFixed(0)}%
                            </span>
                          )}
                        </div>

                        {/* Values */}
                        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between">
                          <div>
                            <span className="text-[10px] text-muted-foreground block">Acumulado</span>
                            <span className="text-base font-bold text-emerald-400">
                              {formatMoney(current)}
                            </span>
                          </div>
                          <div className="text-right">
                            <span className="text-[10px] text-muted-foreground block">Alvo Total</span>
                            <span className="text-sm font-semibold text-foreground">
                              {formatMoney(target)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3 w-full h-2 rounded-full bg-secondary overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{ 
                              width: `${Math.min(100, Math.max(0, pct))}%`,
                              backgroundColor: goal.color || '#6366f1'
                            }}
                          />
                        </div>

                        {goal.monthly_contribution && Number(goal.monthly_contribution) > 0 && (
                          <div className="mt-2 text-[10px] text-muted-foreground flex items-center gap-1">
                            <Sparkles className="w-3 h-3 text-amber-500" />
                            Aporte mensal sugerido: {formatMoney(Number(goal.monthly_contribution))}
                          </div>
                        )}
                      </div>

                      {/* Card Footer Actions */}
                      <div className="mt-5 pt-3 border-t border-border/70 flex items-center justify-between">
                        <button
                          onClick={() => {
                            setContributionModalGoal(goal);
                            setContributionAmount(goal.monthly_contribution?.toString() || '100');
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                        >
                          <DollarSign className="w-3.5 h-3.5" />
                          Adicionar Aporte
                        </button>
                        <button
                          onClick={() => handleDeleteGoal(goal)}
                          className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                          title="Excluir meta"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </main>
      </div>

      <MobileBottomNav />

      {/* Modal: Nova Meta */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <h3 className="font-bold text-sm text-foreground">Nova Meta Financeira</h3>
              <button onClick={() => setIsGoalModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateGoal} className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Título do Objetivo *</label>
                <input
                  type="text"
                  placeholder="Ex: Reserva de Emergência, Viagem Europa, Carro..."
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Valor Alvo (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-bold font-mono tabular-nums"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Já Acumulado (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={goalCurrent}
                      onChange={(e) => setGoalCurrent((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Aporte Mensal (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={goalMonthly}
                      onChange={(e) => setGoalMonthly((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Data Limite (Prazo)</label>
                  <input
                    type="date"
                    value={goalDate}
                    onChange={(e) => setGoalDate(e.target.value)}
                    className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-sm"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Adicionar Aporte */}
      {contributionModalGoal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md shadow-2xl p-6 animate-in fade-in-0 zoom-in-95 duration-200">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <h3 className="font-bold text-sm text-foreground">Fazer Aporte na Meta</h3>
              <button onClick={() => setContributionModalGoal(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3 p-3 rounded-xl bg-secondary/40 border border-border/70 text-xs">
              <span className="font-bold text-foreground block">{contributionModalGoal.title}</span>
              <span className="text-muted-foreground">
                Atual: {formatCurrency(Number(contributionModalGoal.current_amount))} / Alvo: {formatCurrency(Number(contributionModalGoal.target_amount))}
              </span>
            </div>

            <form onSubmit={handleContributionSubmit} className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Valor do Aporte (R$) *</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={contributionAmount}
                    onChange={(e) => setContributionAmount((prev) => maskCurrency(e.target.value, prev))}
                    placeholder="0,00"
                    className="w-full bg-secondary/40 text-foreground text-sm font-bold pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-emerald-500 font-mono tabular-nums"
                    required
                  />
                </div>
                {/* Preset quick buttons */}
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="text-[10px] text-muted-foreground mr-0.5">Atalhos:</span>
                  {[50, 100, 200, 500, 1000].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setContributionAmount(formatNumberToCurrencyInput(val))}
                      className="text-[10px] font-semibold px-2 py-0.5 rounded-lg bg-secondary text-emerald-400 border border-border/80 hover:bg-emerald-500/10 transition-colors"
                    >
                      +R$ {val}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Conta de Origem</label>
                <select
                  value={contributionAccountId}
                  onChange={(e) => setContributionAccountId(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-emerald-500 cursor-pointer"
                >
                  <option value="">Selecione a conta...</option>
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({a.institution})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-border/70">
                <button
                  type="button"
                  onClick={() => setContributionModalGoal(null)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  Confirmar Aporte
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
