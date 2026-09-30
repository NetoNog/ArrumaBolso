'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { 
  useCategories, 
  useBudgets, 
  useGoals, 
  useTransactions, 
  useAccounts, 
  useUpdateCategoryCap, 
  useAddGoal 
} from '@/hooks/use-financial';
import { usePeriod } from '@/components/providers/period-provider';
import { formatCurrency, formatPercent, toCents, fromCents } from '@/lib/financial/formatters';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';
import { 
  Target, 
  ShieldCheck, 
  Plane, 
  TrendingUp, 
  AlertTriangle, 
  CheckCircle2, 
  Plus, 
  CalendarClock,
  Sparkles,
  X,
  Edit2,
  Check,
  Inbox
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

export default function PlanningPage() {
  const { data: categories = [] } = useCategories();
  const { data: budgets = [] } = useBudgets();
  const { data: goals = [] } = useGoals();
  const { data: transactions = [] } = useTransactions();
  const { data: accounts = [] } = useAccounts();

  const updateCapMutation = useUpdateCategoryCap();
  const addGoalMutation = useAddGoal();

  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);
  const [editingCapValue, setEditingCapValue] = useState<string>('');

  // Form de nova meta
  const [goalTitle, setGoalTitle] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('');
  const [goalMonthly, setGoalMonthly] = useState('');
  const [goalDate, setGoalDate] = useState('2025-12-31');

  // Período Global Automático
  const { selectedMonth, setSelectedMonth } = usePeriod();

  // Calcula gastos reais por categoria no mês selecionado com precisão em centavos
  const categorySpentMap = new Map<string, number>();
  transactions
    .filter(t => t.type === 'expense' && t.date.startsWith(selectedMonth))
    .forEach(t => {
      const cur = categorySpentMap.get(t.category_name) || 0;
      categorySpentMap.set(t.category_name, cur + toCents(t.amount));
    });

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseCurrency(goalTarget);
    const current = parseCurrency(goalCurrent);
    const monthly = parseCurrency(goalMonthly);

    if (!goalTitle.trim() || isNaN(target) || target <= 0) {
      toast.error('Preencha os campos obrigatórios da meta.');
      return;
    }

    try {
      await addGoalMutation.mutateAsync({
        title: goalTitle.trim(),
        target_amount: target,
        current_amount: current,
        monthly_contribution: monthly,
        deadline_date: goalDate,
        icon: 'target',
        color: '#8b5cf6',
        is_completed: current >= target
      });

      toast.success('Meta financeira criada com sucesso!');
      setIsGoalModalOpen(false);
      setGoalTitle('');
      setGoalTarget('');
      setGoalCurrent('');
    } catch (err: any) {
      toast.error('Erro ao criar meta.');
    }
  };

  const handleSaveBudgetCap = async (categoryId: string) => {
    const val = parseCurrency(editingCapValue);
    if (isNaN(val) || val < 0) {
      toast.error('Informe um valor de teto válido.');
      return;
    }

    try {
      await updateCapMutation.mutateAsync({ id: categoryId, cap: val });
      setEditingCategoryId(null);
      toast.success('Teto orçamentário atualizado!');
    } catch (err: any) {
      toast.error('Erro ao atualizar teto.');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar accounts={accounts} />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader 
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
        />

        <main className="p-4 sm:p-8 space-y-8 max-w-7xl mx-auto w-full">
          {/* Header Title */}
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Orçamentos & Metas
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                Defina limites para cada categoria e acompanhe suas metas financeiras e reservas.
              </p>
            </div>

            <button
              onClick={() => setIsGoalModalOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all self-start sm:self-auto active:scale-[0.98]"
            >
              <Plus className="w-4 h-4" />
              Nova Meta
            </button>
          </div>

          {/* SECTION 1: METAS FINANCEIRAS & RESERVAS */}
          <div className="space-y-4">
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-500" />
              Metas & Reserva de Emergência
            </h3>

            {goals.length === 0 ? (
              <div className="p-8 rounded-xl bg-card border border-border/70 text-center flex flex-col items-center justify-center space-y-3">
                <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground">
                  <Inbox className="w-5 h-5" />
                </div>
                <h4 className="font-semibold text-sm text-foreground">Nenhuma meta cadastrada ainda</h4>
                <p className="text-xs text-muted-foreground max-w-sm">
                  Crie sua Reserva de Emergência, meta de viagem ou objetivo de patrimônio para acompanhar seu progresso mês a mês.
                </p>
                <button
                  onClick={() => setIsGoalModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Criar Primeira Meta
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {goals.map((goal) => {
                  const rawPercent = goal.target_amount > 0 ? (goal.current_amount / goal.target_amount) * 100 : 0;
                  const percent = isFinite(rawPercent) ? Math.min(100, Math.max(0, rawPercent)) : 0;
                  const remaining = Math.max(0, goal.target_amount - goal.current_amount);
                  const rawMonths = goal.monthly_contribution > 0 ? remaining / goal.monthly_contribution : 0;
                  const monthsRemaining = isFinite(rawMonths) ? Math.ceil(rawMonths) : 0;

                  return (
                    <div key={goal.id} className="p-5 rounded-xl bg-card border border-border/70 shadow-sm flex flex-col justify-between hover:border-border transition-all">
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-8 h-8 rounded-lg bg-secondary/80 text-muted-foreground flex items-center justify-center">
                            {goal.icon === 'plane' ? <Plane className="w-4 h-4" /> : goal.icon === 'shield-check' ? <ShieldCheck className="w-4 h-4" /> : <TrendingUp className="w-4 h-4" />}
                          </div>
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60 tabular-nums">
                            {percent.toFixed(0)}%
                          </span>
                        </div>

                        <h4 className="font-semibold text-sm text-foreground">{goal.title}</h4>
                        {goal.description && (
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{goal.description}</p>
                        )}

                        {/* Progress Bar */}
                        <div className="mt-4 mb-2">
                          <div className="flex justify-between text-xs mb-1 font-medium">
                            <span className="text-foreground tabular-nums">{formatCurrency(goal.current_amount)}</span>
                            <span className="text-muted-foreground tabular-nums">{formatCurrency(goal.target_amount)}</span>
                          </div>
                          <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
                            <div
                              className="bg-primary h-1.5 rounded-full transition-all duration-500"
                              style={{ width: `${percent}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
                        <span>Aporte: <strong className="text-foreground tabular-nums">{formatCurrency(goal.monthly_contribution)}/mês</strong></span>
                        <span className="flex items-center gap-1 text-muted-foreground font-medium">
                          <CalendarClock className="w-3.5 h-3.5" />
                          ~{monthsRemaining} meses
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* SECTION 2: ORÇAMENTOS POR CATEGORIA (LIMITES DE GASTO) */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
                <Target className="w-4 h-4 text-primary" />
                Tetos Orçamentários Mensais
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Defina o teto máximo de gastos de cada categoria para manter suas finanças sob controle.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {categories.filter(c => c.type === 'expense').map((cat) => {
                const spentInCents = categorySpentMap.get(cat.name) || 0;
                const spent = fromCents(spentInCents);
                const budgetCap = cat.monthly_budget_cap || 0;
                const rawPercent = budgetCap > 0 ? (spent / budgetCap) * 100 : 0;
                const percent = isFinite(rawPercent) ? Math.max(0, rawPercent) : 0;
                const isOver = budgetCap > 0 && spent > budgetCap;
                const isWarning = budgetCap > 0 && percent >= 85 && !isOver;
                const isEditing = editingCategoryId === cat.id;

                return (
                  <div key={cat.id} className="p-4 rounded-xl bg-card border border-border/70 shadow-sm flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color || '#6366f1' }} />
                          <h4 className="font-semibold text-xs sm:text-sm text-foreground">{cat.name}</h4>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          {budgetCap > 0 ? (
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                              isOver 
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                                : isWarning 
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20' 
                                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                            }`}>
                              {isOver ? 'Excedido' : isWarning ? 'Atenção' : 'Dentro do Teto'}
                            </span>
                          ) : (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border/60">
                              Sem teto
                            </span>
                          )}

                          <button
                            onClick={() => {
                              if (isEditing) {
                                handleSaveBudgetCap(cat.id);
                              } else {
                                setEditingCategoryId(cat.id);
                                setEditingCapValue(cat.monthly_budget_cap ? formatNumberToCurrencyInput(cat.monthly_budget_cap) : '');
                              }
                            }}
                            className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                            title={isEditing ? 'Salvar teto' : 'Alterar teto'}
                          >
                            {isEditing ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Edit2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>

                      {isEditing ? (
                        <div className="p-2.5 my-2 rounded-lg bg-secondary/60 border border-primary/40 flex items-center gap-2">
                          <span className="text-xs font-bold text-muted-foreground">R$</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="0,00"
                            value={editingCapValue}
                            onChange={(e) => setEditingCapValue((prev) => maskCurrency(e.target.value, prev))}
                            className="bg-card text-foreground text-xs p-1.5 rounded border border-border flex-1 focus:outline-none focus:border-primary font-mono tabular-nums font-semibold"
                            autoFocus
                          />
                          <button
                            onClick={() => handleSaveBudgetCap(cat.id)}
                            className="px-2.5 py-1.5 rounded bg-primary text-primary-foreground text-xs font-semibold shadow-xs"
                          >
                            Salvar
                          </button>
                          <button
                            onClick={() => setEditingCategoryId(null)}
                            className="p-1 text-muted-foreground hover:text-foreground"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-baseline justify-between text-xs mb-1.5">
                          <span className="text-muted-foreground">
                            Gasto Atual: <strong className="text-foreground tabular-nums">{formatCurrency(spent)}</strong>
                          </span>
                          <span className="text-muted-foreground">
                            Teto: <strong className="text-foreground tabular-nums">{budgetCap > 0 ? formatCurrency(budgetCap) : 'Não definido'}</strong> {budgetCap > 0 ? `(${percent.toFixed(0)}%)` : ''}
                          </span>
                        </div>
                      )}

                      {budgetCap > 0 && (
                        <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden mt-1">
                          <div
                            className={`h-1.5 rounded-full transition-all duration-500 ${
                              isOver ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, percent)}%` }}
                          />
                        </div>
                      )}
                    </div>

                    {budgetCap > 0 && (
                      <div className="text-[11px] text-muted-foreground mt-2 flex justify-between">
                        <span>{isOver ? 'Excesso:' : 'Restante seguro:'}</span>
                        <strong className={`tabular-nums ${isOver ? 'text-destructive font-medium' : 'text-emerald-600 dark:text-emerald-400 font-medium'}`}>
                          {formatCurrency(Math.abs(budgetCap - spent))}
                        </strong>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </main>
      </div>

      {/* Goal Modal */}
      {isGoalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
          <div className="bg-card border border-border/80 rounded-xl w-full max-w-md shadow-xl p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-border/70 pb-3">
              <h3 className="font-bold text-sm text-foreground">Nova Meta Financeira</h3>
              <button 
                onClick={() => setIsGoalModalOpen(false)}
                className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddGoal} className="space-y-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">Título da Meta</label>
                <input
                  type="text"
                  placeholder="Ex: Reserva de Emergência, Viagem, Reforma..."
                  value={goalTitle}
                  onChange={(e) => setGoalTitle(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Valor Alvo (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-medium text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="15.000,00"
                      value={goalTarget}
                      onChange={(e) => setGoalTarget((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors font-mono tabular-nums font-semibold"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Já Guardado (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-medium text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={goalCurrent}
                      onChange={(e) => setGoalCurrent((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors font-mono tabular-nums"
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Aporte Mensal (R$)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-medium text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="500,00"
                      value={goalMonthly}
                      onChange={(e) => setGoalMonthly((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors font-mono tabular-nums"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Prazo Estimado</label>
                  <input
                    type="date"
                    value={goalDate}
                    onChange={(e) => setGoalDate(e.target.value)}
                    className="w-full bg-secondary/40 text-foreground text-xs p-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2 border-t border-border/60">
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-[0.98]"
                >
                  Salvar Meta
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <MobileBottomNav />
    </div>
  );
}
