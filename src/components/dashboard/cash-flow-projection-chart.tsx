'use client';

import React, { useState } from 'react';
import { 
  ResponsiveContainer, 
  ComposedChart, 
  Bar, 
  Line, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  CartesianGrid 
} from 'recharts';
import { ProjectionSummary } from '@/lib/financial/projection-engine';
import { formatCurrency } from '@/lib/financial/formatters';
import { TrendingUp, Layers, Info } from 'lucide-react';

interface CashFlowProjectionChartProps {
  projection: ProjectionSummary;
}

export function CashFlowProjectionChart({ projection }: CashFlowProjectionChartProps) {
  const [viewMode, setViewMode] = useState<'stacked' | 'total'>('stacked');
  const [monthSpan, setMonthSpan] = useState<6 | 12>(6);

  const chartData = projection.months.map(m => ({
    name: m.label,
    fullLabel: m.fullLabel,
    Receitas: m.projectedIncome,
    'Despesas Fixas': m.fixedExpenses,
    'Parcelas no Cartão': m.installmentsExpenses,
    'Gastos Variáveis': m.variableExpenses,
    'Despesas Totais': m.totalExpenses,
    'Saldo Acumulado': m.projectedCumulativeBalance,
    'Comprometido': m.compromisedPercentage
  }));

  const displayData = monthSpan === 6 ? chartData.slice(0, 6) : chartData;

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="p-3.5 rounded-xl bg-card border border-border shadow-xl text-xs space-y-2 backdrop-blur-md">
          <p className="font-bold text-foreground text-sm border-b border-border/80 pb-1">
            {data.fullLabel}
          </p>

          <div className="space-y-1">
            <div className="flex justify-between gap-6 text-emerald-400">
              <span>Receitas Previstas:</span>
              <span className="font-semibold tabular-nums">{formatCurrency(data.Receitas)}</span>
            </div>

            {viewMode === 'stacked' ? (
              <>
                <div className="flex justify-between gap-6 text-blue-400">
                  <span>Despesas Fixas:</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(data['Despesas Fixas'])}</span>
                </div>
                <div className="flex justify-between gap-6 text-primary">
                  <span>Parcelas no Cartão:</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(data['Parcelas no Cartão'])}</span>
                </div>
                <div className="flex justify-between gap-6 text-amber-500">
                  <span>Gastos Variáveis (Est.):</span>
                  <span className="font-semibold tabular-nums">{formatCurrency(data['Gastos Variáveis'])}</span>
                </div>
              </>
            ) : (
              <div className="flex justify-between gap-6 text-rose-500">
                <span>Despesas Totais:</span>
                <span className="font-semibold tabular-nums">{formatCurrency(data['Despesas Totais'])}</span>
              </div>
            )}

            <div className="border-t border-border pt-1 flex justify-between gap-6 font-semibold text-foreground">
              <span>Saldo Projetado:</span>
              <span className="text-primary tabular-nums">{formatCurrency(data['Saldo Acumulado'])}</span>
            </div>

            <div className="text-[11px] text-muted-foreground flex justify-between">
              <span>Comprometimento Renda:</span>
              <span className="font-semibold text-foreground">{data.Comprometido.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-6 rounded-xl bg-card border border-border/70 shadow-sm">
      {/* Header with Title and View Toggles */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm sm:text-base font-bold text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              Projeção de Fluxo de Caixa (12 Meses)
            </h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-semibold border border-border">
              Preditivo
            </span>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Evolução de receitas, despesas fixas, amortização de parcelas e saldo acumulado
          </p>
        </div>

        {/* Controls: Month Span & View Mode */}
        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto text-xs">
          {/* 6m vs 12m Selector */}
          <div className="flex items-center bg-secondary/60 p-0.5 rounded-lg border border-border/70 text-xs">
            <button
              onClick={() => setMonthSpan(6)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                monthSpan === 6
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              6 meses
            </button>
            <button
              onClick={() => setMonthSpan(12)}
              className={`px-2.5 py-1 rounded-md transition-all ${
                monthSpan === 12
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              12 meses
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-secondary/60 p-0.5 rounded-lg border border-border/70 text-xs">
            <button
              onClick={() => setViewMode('stacked')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'stacked'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Detalhamento
            </button>
            <button
              onClick={() => setViewMode('total')}
              className={`px-2.5 py-1 rounded-md transition-all ${
                viewMode === 'total'
                  ? 'bg-card text-foreground font-semibold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              Consolidado
            </button>
          </div>
        </div>
      </div>

      {/* Main Chart */}
      <div className="h-72 sm:h-80 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={displayData} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(150,150,150,0.08)" vertical={false} />
            <XAxis 
              dataKey="name" 
              tick={{ fill: '#71717a', fontSize: 11 }} 
              stroke="transparent"
            />
            <YAxis 
              yAxisId="left" 
              tick={{ fill: '#71717a', fontSize: 11 }} 
              stroke="transparent"
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
            />
            <YAxis 
              yAxisId="right" 
              orientation="right" 
              tick={{ fill: '#818cf8', fontSize: 11 }} 
              stroke="transparent"
              tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend 
              wrapperStyle={{ paddingTop: '12px', fontSize: '11px' }} 
              formatter={(value) => <span className="text-muted-foreground text-xs">{value}</span>}
            />

            {/* Inflows */}
            <Bar yAxisId="left" dataKey="Receitas" fill="#10b981" radius={[3, 3, 0, 0]} maxBarSize={24} />

            {/* Outflows */}
            {viewMode === 'stacked' ? (
              <>
                <Bar yAxisId="left" dataKey="Despesas Fixas" stackId="exp" fill="#64748b" maxBarSize={24} />
                <Bar yAxisId="left" dataKey="Parcelas no Cartão" stackId="exp" fill="#6366f1" maxBarSize={24} />
                <Bar yAxisId="left" dataKey="Gastos Variáveis" stackId="exp" fill="#f59e0b" radius={[3, 3, 0, 0]} maxBarSize={24} />
              </>
            ) : (
              <Bar yAxisId="left" dataKey="Despesas Totais" fill="#f43f5e" radius={[3, 3, 0, 0]} maxBarSize={24} />
            )}

            {/* Cumulative Balance Line */}
            <Line 
              yAxisId="right" 
              type="monotone" 
              dataKey="Saldo Acumulado" 
              stroke="#6366f1" 
              strokeWidth={2.5}
              dot={{ r: 3, fill: '#6366f1' }}
              activeDot={{ r: 5 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Footer Badges */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-6 pt-4 border-t border-border/60">
        <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Saldo em 12 Meses:</span>
          <span className="text-sm font-bold text-foreground tabular-nums">
            {formatCurrency(projection.finalProjectedBalance)}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Poupança Projetada:</span>
          <span className="text-sm font-bold text-primary tabular-nums">
            {formatCurrency(projection.twelveMonthsNetSavings)}
          </span>
        </div>

        <div className="p-3 rounded-lg bg-secondary/30 border border-border/60 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">Menor Caixa Previsto:</span>
          <span className="text-sm font-bold text-amber-500 tabular-nums">
            {projection.lowestBalanceMonth.label} ({formatCurrency(projection.lowestBalanceMonth.balance)})
          </span>
        </div>
      </div>
    </div>
  );
}
