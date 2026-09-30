'use client';

import React from 'react';
import { ArrowUpRight, ArrowDownRight, AlertCircle, CheckCircle, BarChart3 } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/formatters';

interface MonthComparisonProps {
  currentTotal: number;
  previousTotal: number;
  currentMonthLabel?: string;
  previousMonthLabel?: string;
  categoryDeltas: {
    category: string;
    current: number;
    previous: number;
    percentChange: number;
    isOverloaded: boolean;
  }[];
}

export function MonthComparisonCard({
  currentTotal,
  previousTotal,
  currentMonthLabel = 'Mês Atual',
  previousMonthLabel = 'Mês Anterior',
  categoryDeltas
}: MonthComparisonProps) {
  const hasComparison = previousTotal > 0 || currentTotal > 0;
  const diff = currentTotal - previousTotal;
  const overallPercent = previousTotal > 0 ? (diff / previousTotal) * 100 : 0;
  const isSpendingMore = diff > 0;

  const overloadedCategories = categoryDeltas.filter(c => c.isOverloaded);

  return (
    <div className="p-6 rounded-xl bg-card border border-border/70 shadow-sm flex flex-col justify-between min-h-[360px]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h4 className="text-sm font-bold text-foreground">Comparativo Mensal</h4>
            <p className="text-xs text-muted-foreground">Variação de gastos em relação a {previousMonthLabel}</p>
          </div>
          {previousTotal > 0 && (
            <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-0.5 rounded-full border ${
              isSpendingMore 
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20' 
                : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
            }`}>
              {isSpendingMore ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
              {overallPercent > 0 ? `+${overallPercent.toFixed(1)}%` : `${overallPercent.toFixed(1)}%`}
            </span>
          )}
        </div>

        {hasComparison ? (
          <>
            {/* Totals Summary */}
            <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/60 mb-4">
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{currentMonthLabel}</span>
                <div className="text-base sm:text-lg font-bold text-foreground tabular-nums">{formatCurrency(currentTotal)}</div>
              </div>
              <div>
                <span className="text-[10px] text-muted-foreground uppercase font-bold tracking-wider">{previousMonthLabel}</span>
                <div className="text-base sm:text-lg font-bold text-muted-foreground tabular-nums">{formatCurrency(previousTotal)}</div>
              </div>
            </div>

            {/* Category Alerts */}
            {categoryDeltas.length > 0 ? (
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-foreground block mb-2">
                  Variação por Categoria:
                </span>

                {categoryDeltas.slice(0, 4).map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                    <div className="flex items-center gap-2">
                      {item.isOverloaded ? (
                        <AlertCircle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      ) : (
                        <CheckCircle className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                      )}
                      <span className="text-foreground font-medium">{item.category}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-muted-foreground tabular-nums">{formatCurrency(item.current)}</span>
                      <span className={`font-semibold tabular-nums ${item.percentChange > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {item.percentChange > 0 ? `+${item.percentChange.toFixed(0)}%` : `${item.percentChange.toFixed(0)}%`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic py-2">
                Nenhuma variação relevante identificada até o momento.
              </p>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground mb-1">
              <BarChart3 className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">Histórico em construção</p>
            <p className="text-xs max-w-xs text-muted-foreground">
              Conforme você registrar movimentações nos próximos meses, as comparações e tendências aparecerão aqui.
            </p>
          </div>
        )}
      </div>

      {/* Alert Banner if overloaded categories exist */}
      {overloadedCategories.length > 0 && (
        <div className="mt-4 p-3 rounded-xl bg-secondary/50 border border-border text-xs text-muted-foreground flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <span>
            <strong className="text-foreground">Aviso:</strong> {overloadedCategories.length} categoria(s) tiveram alta expressiva (&gt;15%) frente ao mês anterior.
          </span>
        </div>
      )}
    </div>
  );
}
