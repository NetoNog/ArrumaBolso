'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { 
  Zap, 
  AlertTriangle, 
  Repeat, 
  CheckCircle2, 
  TrendingUp, 
  TrendingDown,
  ArrowRight,
  Flame,
  ShieldCheck,
  ShieldAlert,
  Calendar,
  Sparkles,
  ExternalLink,
  Plus
} from 'lucide-react';
import { Transaction, MonthlyBudget, Category, FixedExpense } from '@/lib/supabase/types';
import { usePrivacy } from '@/components/providers/privacy-provider';
import { format, getDaysInMonth, getDate } from 'date-fns';

interface AiFinancialInsightsProps {
  transactions: Transaction[];
  fixedExpenses?: FixedExpense[];
  budgets?: MonthlyBudget[];
  categories?: Category[];
  selectedMonth?: string;
  baseIncome?: number;
}

export function AiFinancialInsights({
  transactions = [],
  fixedExpenses = [],
  budgets = [],
  categories = [],
  selectedMonth,
  baseIncome = 0
}: AiFinancialInsightsProps) {
  const { formatMoney } = usePrivacy();

  const currentMonthKey = selectedMonth || format(new Date(), 'yyyy-MM');
  const now = new Date();
  const currentActualMonthKey = format(now, 'yyyy-MM');
  const isSelectedCurrentMonth = currentMonthKey === currentActualMonthKey;
  const isPastMonth = currentMonthKey < currentActualMonthKey;
  const isFutureMonth = currentMonthKey > currentActualMonthKey;

  // Filtrar transações do mês selecionado
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(currentMonthKey));
  }, [transactions, currentMonthKey]);

  // Total de despesas pagas no mês
  const totalExpense = useMemo(() => {
    return monthTransactions
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);
  }, [monthTransactions]);

  // Total de receitas do mês
  const totalIncome = useMemo(() => {
    const inc = monthTransactions
      .filter(t => t.type === 'income' && t.status === 'completed')
      .reduce((sum, t) => sum + Number(t.amount), 0);
    return inc > 0 ? inc : (baseIncome > 0 ? baseIncome : 0);
  }, [monthTransactions, baseIncome]);

  // ==========================================
  // 1. PREVISÃO DE FECHAMENTO (RUN-RATE)
  // ==========================================
  const projection = useMemo(() => {
    const [year, month] = currentMonthKey.split('-').map(Number);
    const monthDate = new Date(year, month - 1, 1);
    const totalDays = getDaysInMonth(monthDate);
    
    let currentDay = totalDays;
    let daysRemaining = 0;

    if (isSelectedCurrentMonth) {
      currentDay = Math.min(getDate(now), totalDays);
      daysRemaining = Math.max(0, totalDays - currentDay);
    } else if (isPastMonth) {
      currentDay = totalDays;
      daysRemaining = 0;
    } else if (isFutureMonth) {
      currentDay = 0;
      daysRemaining = totalDays;
    }

    const dailyBurnRate = currentDay > 0 ? totalExpense / currentDay : 0;
    const projectedAdditionalExpense = isSelectedCurrentMonth ? (dailyBurnRate * daysRemaining) : 0;
    const projectedFinalExpense = totalExpense + projectedAdditionalExpense;
    const projectedFinalBalance = totalIncome - projectedFinalExpense;

    // Teto diário seguro para não entrar no vermelho
    const remainingIncomeBuffer = totalIncome - totalExpense;
    const safeDailyAllowance = (daysRemaining > 0 && remainingIncomeBuffer > 0)
      ? remainingIncomeBuffer / daysRemaining
      : 0;

    // Percentual de tempo decorrido vs percentual de renda consumida
    const timeProgressPct = totalDays > 0 ? Math.min(100, Math.round((currentDay / totalDays) * 100)) : 0;
    const expenseProgressPct = totalIncome > 0 ? Math.min(100, Math.round((totalExpense / totalIncome) * 100)) : 0;
    const isBurningFasterThanTime = isSelectedCurrentMonth && totalIncome > 0 && expenseProgressPct > (timeProgressPct + 5);

    return {
      currentDay,
      totalDays,
      daysRemaining,
      dailyBurnRate,
      projectedFinalExpense,
      projectedFinalBalance,
      safeDailyAllowance,
      timeProgressPct,
      expenseProgressPct,
      isBurningFasterThanTime
    };
  }, [currentMonthKey, isSelectedCurrentMonth, isPastMonth, isFutureMonth, totalExpense, totalIncome, now]);

  // ==========================================
  // 2. MONITOR DE TETOS & LIMITES
  // ==========================================
  const { monitoredCategories, topSpentWithoutCap, totalCapsCount, alertCapsCount } = useMemo(() => {
    // Mapa de gastos por categoria no mês
    const catSpentMap = new Map<string, number>();
    monthTransactions
      .filter(t => t.type === 'expense' && t.status === 'completed')
      .forEach(t => {
        const key = t.category_id || t.category_name || 'Geral';
        catSpentMap.set(key, (catSpentMap.get(key) || 0) + Number(t.amount));
      });

    interface MonitoredItem {
      id: string;
      name: string;
      color: string;
      spent: number;
      cap: number;
      percentage: number;
      remaining: number;
      status: 'exceeded' | 'warning' | 'normal';
    }

    const monitored: MonitoredItem[] = [];

    // Avaliar categorias cadastradas
    categories.forEach(cat => {
      // Procura teto configurado na categoria ou no array de orçamentos
      const budget = budgets.find(b => b.category_id === cat.id || b.category_id === cat.name);
      const cap = Number(cat.monthly_budget_cap || 0) || (budget ? Number(budget.budgeted_amount) : 0);

      if (cap > 0) {
        const spent = catSpentMap.get(cat.id) || catSpentMap.get(cat.name) || 0;
        const percentage = (spent / cap) * 100;
        const remaining = cap - spent;

        let status: 'exceeded' | 'warning' | 'normal' = 'normal';
        if (percentage >= 100) {
          status = 'exceeded';
        } else if (percentage >= 80) {
          status = 'warning';
        }

        monitored.push({
          id: cat.id,
          name: cat.name,
          color: cat.color || '#6366f1',
          spent,
          cap,
          percentage,
          remaining,
          status
        });
      }
    });

    // Ordenar: primeiro as que estouraram/alerta, depois por maior percentual
    monitored.sort((a, b) => b.percentage - a.percentage);

    // Se nenhuma tiver teto, identificar as 2 categorias com maior gasto para recomendar definição de teto
    const topSpent: { name: string; amount: number }[] = [];
    if (monitored.length === 0) {
      const sortedEntries = Array.from(catSpentMap.entries()).sort((a, b) => b[1] - a[1]);
      sortedEntries.slice(0, 2).forEach(([catKey, amount]) => {
        const catObj = categories.find(c => c.id === catKey || c.name === catKey);
        topSpent.push({
          name: catObj?.name || catKey,
          amount
        });
      });
    }

    const alertCount = monitored.filter(m => m.status === 'exceeded' || m.status === 'warning').length;

    return {
      monitoredCategories: monitored,
      topSpentWithoutCap: topSpent,
      totalCapsCount: monitored.length,
      alertCapsCount: alertCount
    };
  }, [categories, budgets, monthTransactions]);

  // ==========================================
  // 3. ASSINATURAS & RECORRÊNCIAS
  // ==========================================
  const { allSubscriptions, totalMonthlySubscriptions, annualCostImpact } = useMemo(() => {
    interface SubItem {
      id: string;
      name: string;
      amount: number;
      dueDay?: number;
      category?: string;
      source: 'fixed' | 'detected';
    }

    const items: SubItem[] = [];
    const addedNames = new Set<string>();

    // 1. Adicionar Gastos Fixos cadastrados ativos
    fixedExpenses
      .filter(f => f.is_active !== false)
      .forEach(f => {
        const norm = f.name.toLowerCase().trim();
        addedNames.add(norm);
        items.push({
          id: f.id,
          name: f.name,
          amount: Number(f.amount),
          dueDay: f.due_day,
          category: f.category_name,
          source: 'fixed'
        });
      });

    // 2. Detectar assinaturas recorrentes nas transações que não estão em fixedExpenses
    const subscriptionKeywords = [
      'netflix', 'spotify', 'prime', 'amazon', 'youtube', 'disney', 'hbo', 'max',
      'apple', 'icloud', 'google one', 'chatgpt', 'openai', 'deezer', 'gympass',
      'smartfit', 'smart fit', 'bluefit', 'claro', 'vivo', 'tim', 'oi', 'internet',
      'adobe', 'canva', 'github', 'vercel', 'notion', 'duolingo', 'playstation', 'xbox'
    ];

    transactions.forEach(t => {
      if (t.type !== 'expense') return;
      const descLower = (t.description || '').toLowerCase();

      const matchedKw = subscriptionKeywords.find(kw => descLower.includes(kw));
      if (matchedKw || t.is_recurring) {
        const normKey = (matchedKw || descLower.substring(0, 15)).trim();
        const alreadyInList = Array.from(addedNames).some(name => name.includes(normKey) || normKey.includes(name));

        if (!alreadyInList) {
          addedNames.add(normKey);
          items.push({
            id: t.id,
            name: t.description.length > 20 ? t.description.substring(0, 20) + '...' : t.description,
            amount: Number(t.amount),
            category: t.category_name,
            source: 'detected'
          });
        }
      }
    });

    const totalMonthly = items.reduce((acc, sub) => acc + sub.amount, 0);
    const annualImpact = totalMonthly * 12;

    return {
      allSubscriptions: items,
      totalMonthlySubscriptions: totalMonthly,
      annualCostImpact: annualImpact
    };
  }, [fixedExpenses, transactions]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
      {/* ========================================================
          CARD 1: PREVISÃO DE FECHAMENTO (RUN-RATE)
      ======================================================== */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-violet-500/40 transition-all">
        {/* Glow de fundo sutil */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-violet-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center justify-center">
                <Zap className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Previsão de Fechamento</h4>
                <p className="text-[10px] text-muted-foreground">Projeção por ritmo diário (Run-rate)</p>
              </div>
            </div>

            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
              isSelectedCurrentMonth
                ? 'bg-violet-500/10 text-violet-400 border-violet-500/20'
                : 'bg-secondary text-muted-foreground border-border/60'
            }`}>
              {isSelectedCurrentMonth
                ? `${projection.daysRemaining} dias restantes`
                : isPastMonth ? 'Mês Encerrado' : 'Mês Futuro'}
            </span>
          </div>

          {/* Métricas Principais */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
              <span className="text-[10px] font-medium text-muted-foreground block">Despesa Projetada</span>
              <span className="text-base font-bold text-foreground tabular-nums block mt-0.5">
                {formatMoney(projection.projectedFinalExpense)}
              </span>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                Atual: {formatMoney(totalExpense)}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-secondary/30 border border-border/60">
              <span className="text-[10px] font-medium text-muted-foreground block">Saldo Estimado ao Fim</span>
              <span className={`text-base font-extrabold tabular-nums block mt-0.5 ${
                projection.projectedFinalBalance >= 0 ? 'text-emerald-400' : 'text-rose-400'
              }`}>
                {projection.projectedFinalBalance >= 0 ? '+' : ''}
                {formatMoney(projection.projectedFinalBalance)}
              </span>
              <span className="text-[9px] text-muted-foreground tabular-nums">
                Renda: {formatMoney(totalIncome)}
              </span>
            </div>
          </div>

          {/* Ritmo Diário & Teto Seguro */}
          <div className="p-3 rounded-xl bg-secondary/20 border border-border/50 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Flame className="w-3.5 h-3.5 text-amber-400" />
                Gasto Médio Diário:
              </span>
              <span className="font-bold text-foreground tabular-nums">
                {formatMoney(projection.dailyBurnRate)}/dia
              </span>
            </div>

            {isSelectedCurrentMonth && projection.daysRemaining > 0 && (
              <div className="flex items-center justify-between text-xs pt-1 border-t border-border/40">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  Teto Diário Seguro:
                </span>
                <span className={`font-bold tabular-nums ${
                  projection.safeDailyAllowance > 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {projection.safeDailyAllowance > 0
                    ? `${formatMoney(projection.safeDailyAllowance)}/dia`
                    : 'Sem margem'}
                </span>
              </div>
            )}
          </div>

          {/* Comparativo Visual: Tempo Decorrido vs Renda Consumida */}
          {isSelectedCurrentMonth && (
            <div className="space-y-1.5 pt-1">
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>Progresso do mês: {projection.timeProgressPct}%</span>
                <span>Renda gasta: {projection.expenseProgressPct}%</span>
              </div>
              <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden relative">
                <div 
                  className={`h-full rounded-full transition-all duration-700 ${
                    projection.isBurningFasterThanTime ? 'bg-amber-400' : 'bg-emerald-400'
                  }`}
                  style={{ width: `${Math.min(100, projection.expenseProgressPct)}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Insight Sintético no Rodapé */}
        <div className="pt-3 mt-3 border-t border-border/60">
          <p className="text-[11px] leading-relaxed">
            {projection.projectedFinalBalance >= 0 ? (
              <span className="text-emerald-400 font-medium flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                Ritmo equilibrado! Mantendo o padrão, sobrará {formatMoney(projection.projectedFinalBalance)}.
              </span>
            ) : (
              <span className="text-rose-400 font-medium flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                Alerta de déficit: corte gastos discricionários para evitar rombo projetado.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* ========================================================
          CARD 2: MONITOR DE TETOS & LIMITES
      ======================================================== */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-amber-500/40 transition-all">
        {/* Glow de fundo sutil */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center justify-center">
                <AlertTriangle className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Monitor de Tetos & Limites</h4>
                <p className="text-[10px] text-muted-foreground">Vigilância de limites orçamentários</p>
              </div>
            </div>

            <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-semibold border ${
              alertCapsCount > 0
                ? 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                : totalCapsCount > 0
                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                : 'bg-secondary text-muted-foreground border-border/60'
            }`}>
              {alertCapsCount > 0
                ? `${alertCapsCount} em alerta`
                : totalCapsCount > 0
                ? 'Tetos sob controle'
                : 'Sem tetos'}
            </span>
          </div>

          {/* Conteúdo Dinâmico */}
          {totalCapsCount > 0 ? (
            <div className="space-y-2.5">
              {monitoredCategories.slice(0, 3).map((item) => {
                const isExceeded = item.percentage >= 100;
                const isWarning = item.percentage >= 80 && item.percentage < 100;

                return (
                  <div key={item.id} className="p-2.5 rounded-xl bg-secondary/30 border border-border/60 space-y-1.5">
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 truncate">
                        <span 
                          className="w-2 h-2 rounded-full shrink-0" 
                          style={{ backgroundColor: item.color }} 
                        />
                        <span className="font-semibold text-foreground truncate">{item.name}</span>
                      </div>

                      <span className={`text-[11px] font-bold tabular-nums shrink-0 ml-2 ${
                        isExceeded ? 'text-rose-400' : isWarning ? 'text-amber-400' : 'text-emerald-400'
                      }`}>
                        {item.percentage.toFixed(0)}%
                      </span>
                    </div>

                    {/* Barra de Progresso */}
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          isExceeded ? 'bg-rose-500' : isWarning ? 'bg-amber-400' : 'bg-emerald-400'
                        }`}
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-muted-foreground tabular-nums">
                      <span>Gasto: {formatMoney(item.spent)}</span>
                      <span>
                        {isExceeded 
                          ? `Excedeu ${formatMoney(Math.abs(item.remaining))}` 
                          : `Resta ${formatMoney(item.remaining)}`}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* Estado quando usuário ainda não definiu tetos */
            <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                Você ainda não definiu tetos mensais nas suas categorias. Defina limites para receber alertas automáticos de estouro!
              </p>

              {topSpentWithoutCap.length > 0 && (
                <div className="space-y-1.5 pt-1 border-t border-border/40">
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider block">
                    Maiores gastos deste mês:
                  </span>
                  {topSpentWithoutCap.map((top, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-foreground truncate">{top.name}</span>
                      <span className="font-bold text-foreground tabular-nums">{formatMoney(top.amount)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Link / CTA no Rodapé */}
        <div className="pt-3 mt-3 border-t border-border/60">
          <Link
            href="/planning"
            className="text-xs text-amber-400 hover:text-amber-300 font-semibold flex items-center justify-between group/link transition-colors"
          >
            <span>{totalCapsCount > 0 ? 'Gerenciar tetos no Planejamento' : 'Configurar Tetos Orçamentários'}</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>

      {/* ========================================================
          CARD 3: ASSINATURAS & RECORRÊNCIAS
      ======================================================== */}
      <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden flex flex-col justify-between group hover:border-cyan-500/40 transition-all">
        {/* Glow de fundo sutil */}
        <div className="absolute -top-12 -right-12 w-28 h-28 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 flex items-center justify-center">
                <Repeat className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-foreground">Assinaturas & Recorrências</h4>
                <p className="text-[10px] text-muted-foreground">Compromissos fixos e serviços</p>
              </div>
            </div>

            <span className="text-xs font-extrabold text-cyan-400 tabular-nums">
              {formatMoney(totalMonthlySubscriptions)}/mês
            </span>
          </div>

          {/* Destaque de Impacto Anual */}
          <div className="p-3 rounded-xl bg-cyan-500/5 border border-cyan-500/20 flex items-center justify-between">
            <div>
              <span className="text-[10px] text-muted-foreground block font-medium">Impacto no Ano</span>
              <span className="text-sm font-bold text-cyan-400 tabular-nums">
                {formatMoney(annualCostImpact)}/ano
              </span>
            </div>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/10 text-cyan-300 font-semibold border border-cyan-500/20">
              {allSubscriptions.length} {allSubscriptions.length === 1 ? 'item ativo' : 'itens ativos'}
            </span>
          </div>

          {/* Lista de Assinaturas e Recorrências */}
          {allSubscriptions.length > 0 ? (
            <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
              {allSubscriptions.slice(0, 4).map((sub) => (
                <div 
                  key={sub.id} 
                  className="flex items-center justify-between text-xs p-2 rounded-xl bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-colors"
                >
                  <div className="min-w-0 pr-2">
                    <span className="font-semibold text-foreground truncate block">{sub.name}</span>
                    <span className="text-[10px] text-muted-foreground">
                      {sub.dueDay ? `Vence dia ${sub.dueDay}` : (sub.category || 'Serviço recorrente')}
                    </span>
                  </div>

                  <span className="font-bold text-foreground tabular-nums shrink-0">
                    {formatMoney(sub.amount)}
                  </span>
                </div>
              ))}

              {allSubscriptions.length > 4 && (
                <p className="text-[10px] text-center text-muted-foreground pt-0.5">
                  +{allSubscriptions.length - 4} outros compromissos cadastrados
                </p>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-secondary/30 border border-dashed border-border/60 text-center space-y-2">
              <Repeat className="w-5 h-5 text-muted-foreground mx-auto" />
              <p className="text-xs text-muted-foreground leading-relaxed">
                Nenhuma assinatura ou gasto fixo identificado. Cadastre suas contas para monitorar o peso anual.
              </p>
            </div>
          )}
        </div>

        {/* Link / CTA no Rodapé */}
        <div className="pt-3 mt-3 border-t border-border/60">
          <Link
            href="/fixed-debts"
            className="text-xs text-cyan-400 hover:text-cyan-300 font-semibold flex items-center justify-between group/link transition-colors"
          >
            <span>Gerenciar Gastos Fixos & Dívidas</span>
            <ArrowRight className="w-3.5 h-3.5 group-hover/link:translate-x-1 transition-transform" />
          </Link>
        </div>
      </div>
    </div>
  );
}
