'use client';

import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { formatCurrency, formatPercent } from '@/lib/financial/formatters';
import { PieChart as PieChartIcon, Inbox } from 'lucide-react';

interface CategorySpend {
  name: string;
  amount: number;
  color: string;
  percentage: number;
}

interface CategoryBreakdownChartProps {
  categories: CategorySpend[];
  totalExpense: number;
}

export function CategoryBreakdownChart({ categories, totalExpense }: CategoryBreakdownChartProps) {
  const sorted = [...categories].sort((a, b) => b.amount - a.amount);
  const hasData = sorted.length > 0 && totalExpense > 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3 rounded-xl bg-card border border-border/80 shadow-md text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: data.color }} />
            <span className="font-bold text-foreground">{data.name}</span>
          </div>
          <div className="text-muted-foreground flex justify-between gap-4">
            <span>Total Gasto:</span>
            <strong className="text-foreground tabular-nums">{formatCurrency(data.amount)}</strong>
          </div>
          <div className="text-muted-foreground flex justify-between gap-4">
            <span>Participação:</span>
            <strong className="text-foreground tabular-nums">{formatPercent(data.percentage)}</strong>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 rounded-xl bg-card border border-border/70 shadow-sm flex flex-col justify-between min-h-[360px]">
      <div>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <PieChartIcon className="w-4 h-4 text-muted-foreground" />
            <h4 className="text-sm font-bold text-foreground">Despesas por Categoria</h4>
          </div>
          <span className="text-xs text-muted-foreground">
            Total: <strong className="text-foreground tabular-nums">{formatCurrency(totalExpense)}</strong>
          </span>
        </div>

        {hasData ? (
          <>
            {/* Donut Chart with Center Total */}
            <div className="relative h-56 w-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Tooltip content={<CustomTooltip />} />
                  <Pie
                    data={sorted}
                    dataKey="amount"
                    nameKey="name"
                    innerRadius={65}
                    outerRadius={90}
                    paddingAngle={3}
                    stroke="none"
                  >
                    {sorted.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>

              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                  Total
                </span>
                <span className="text-lg font-bold text-foreground tabular-nums">
                  {formatCurrency(totalExpense)}
                </span>
              </div>
            </div>

            {/* Category List Breakdown */}
            <div className="space-y-1.5 mt-4 max-h-56 overflow-y-auto pr-1">
              {sorted.slice(0, 6).map((cat, i) => (
                <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/40 last:border-0">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                    <span className="text-muted-foreground font-medium truncate">{cat.name}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="font-semibold text-foreground tabular-nums">{formatCurrency(cat.amount)}</span>
                    <span className="text-muted-foreground text-[11px] tabular-nums w-10 text-right">{formatPercent(cat.percentage)}</span>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center py-12 text-center text-muted-foreground space-y-2">
            <div className="w-10 h-10 rounded-xl bg-secondary flex items-center justify-center text-muted-foreground mb-1">
              <Inbox className="w-5 h-5" />
            </div>
            <p className="text-sm font-semibold text-foreground">Nenhuma despesa neste período</p>
            <p className="text-xs max-w-xs text-muted-foreground">
              Cadastre despesas manuais ou importe sua fatura do Nubank para ver o detalhamento visual.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
