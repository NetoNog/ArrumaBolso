'use client';

import React from 'react';
import Link from 'next/link';
import { Flame, AlertTriangle, CheckCircle2, ShieldAlert, CalendarClock, ArrowRight } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/formatters';
import { BurnRateResult } from '@/lib/financial/burn-rate';

interface BurnRateGaugeProps {
  burnRate: BurnRateResult;
}

export function BurnRateGauge({ burnRate }: BurnRateGaugeProps) {
  const {
    totalBudget,
    totalSpent,
    remainingBudget,
    daysRemaining,
    dailySafeSpend,
    actualDailySpend,
    status,
    statusMessage
  } = burnRate;

  const hasBudgetConfigured = totalBudget > 0 || totalSpent > 0;

  const statusConfig = {
    safe: {
      badge: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
      barColor: 'bg-emerald-500',
      icon: CheckCircle2,
      label: 'Ritmo Seguro'
    },
    warning: {
      badge: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
      barColor: 'bg-amber-500',
      icon: AlertTriangle,
      label: 'Atenção ao Ritmo'
    },
    danger: {
      badge: 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20',
      barColor: 'bg-rose-500',
      icon: ShieldAlert,
      label: 'Ritmo Acelerado'
    }
  }[status];

  const StatusIcon = statusConfig.icon;
  const spentPercent = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  return (
    <div className="p-6 rounded-xl bg-card border border-border/70 shadow-sm transition-all">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center text-foreground">
            <Flame className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-foreground">Ritmo de Gastos Diário</h4>
            <p className="text-xs text-muted-foreground">Velocidade de consumo do orçamento do mês</p>
          </div>
        </div>

        {hasBudgetConfigured && (
          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border self-start sm:self-auto ${statusConfig.badge}`}>
            <StatusIcon className="w-3.5 h-3.5" />
            {statusConfig.label}
          </span>
        )}
      </div>

      {hasBudgetConfigured ? (
        <>
          {/* Metrics Spotlight */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 my-3 p-4 rounded-xl bg-secondary/30 border border-border/60">
            <div>
              <div className="text-xs text-muted-foreground font-medium flex items-center gap-1.5">
                <span>Teto Diário Seguro</span>
                <span className="text-[10px] text-muted-foreground">({daysRemaining} dias restantes)</span>
              </div>
              <div className="text-2xl font-bold text-foreground mt-1 tabular-nums">
                {formatCurrency(dailySafeSpend)}
                <span className="text-xs text-muted-foreground font-normal"> / dia</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                Limite recomendado para fechar o mês no azul
              </p>
            </div>

            <div className="border-t sm:border-t-0 sm:border-l border-border/60 pt-3 sm:pt-0 sm:pl-4">
              <div className="text-xs text-muted-foreground font-medium">Média Real Consumida</div>
              <div className={`text-2xl font-bold mt-1 tabular-nums ${actualDailySpend > dailySafeSpend ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {formatCurrency(actualDailySpend)}
                <span className="text-xs text-muted-foreground font-normal"> / dia</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {actualDailySpend > dailySafeSpend ? (
                  <span className="text-destructive font-medium">
                    Excedendo R$ {(actualDailySpend - dailySafeSpend).toFixed(2)}/dia acima do seguro
                  </span>
                ) : (
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    Folga de R$ {(dailySafeSpend - actualDailySpend).toFixed(2)}/dia em relação ao limite
                  </span>
                )}
              </p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="space-y-1.5 my-4">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">
                Consumido: <strong className="text-foreground tabular-nums">{formatCurrency(totalSpent)}</strong> de {formatCurrency(totalBudget)}
              </span>
              <span className="font-semibold text-foreground tabular-nums">{spentPercent.toFixed(1)}%</span>
            </div>
            <div className="w-full bg-secondary rounded-full h-1.5 overflow-hidden">
              <div 
                className={`h-1.5 rounded-full ${statusConfig.barColor} transition-all duration-500`}
                style={{ width: `${Math.min(100, Math.max(0, spentPercent))}%` }}
              />
            </div>
          </div>

          {/* Footer Info */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 text-xs text-muted-foreground pt-3 border-t border-border/60">
            <div className="flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5 text-muted-foreground" />
              <span>Restam <strong className="text-foreground tabular-nums">{formatCurrency(remainingBudget)}</strong> para os próximos <strong className="text-foreground">{daysRemaining} dias</strong></span>
            </div>
            <span className="text-[11px] italic">{statusMessage}</span>
          </div>
        </>
      ) : (
        <div className="p-4 rounded-xl bg-secondary/30 border border-border/70 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-muted-foreground">
            Defina limites para suas categorias em &quot;Orçamentos & Metas&quot; para ativar o cálculo automático de ritmo de gastos seguro.
          </div>
          <Link
            href="/planning"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary hover:bg-secondary/80 text-foreground font-semibold border border-border/80 whitespace-nowrap transition-colors"
          >
            Configurar Orçamentos
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      )}
    </div>
  );
}
