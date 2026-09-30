import React from 'react';
import { LucideIcon, TrendingUp, TrendingDown } from 'lucide-react';
import { formatCurrency } from '@/lib/financial/formatters';

interface KPICardProps {
  title: string;
  value: number;
  formatAsCurrency?: boolean;
  prefix?: string;
  suffix?: string;
  subtitle?: string;
  delta?: {
    value: number;
    isPositiveGood: boolean;
    label: string;
  };
  icon: LucideIcon;
  iconColor?: string;
  badge?: string;
  progressPercent?: number;
}

export function KPICard({
  title,
  value,
  formatAsCurrency = true,
  prefix = '',
  suffix = '',
  subtitle,
  delta,
  icon: Icon,
  iconColor,
  badge,
  progressPercent
}: KPICardProps) {
  const isPositive = delta ? delta.value >= 0 : false;
  const isGood = delta ? (delta.isPositiveGood ? isPositive : !isPositive) : true;

  // Cor do badge de acordo com conteúdo
  const badgeStyle = badge === 'Saudável' || badge === 'Real'
    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
    : badge === 'Atenção' || badge === 'Alerta'
    ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
    : 'bg-secondary text-muted-foreground border-border/60';

  return (
    <div className="p-5 rounded-xl bg-card border border-border/70 shadow-sm relative overflow-hidden group hover:border-border transition-all">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-muted-foreground">
          {title}
        </span>
        <div className="w-8 h-8 rounded-lg bg-secondary/60 flex items-center justify-center text-muted-foreground group-hover:text-foreground transition-colors">
          <Icon className="w-4 h-4" />
        </div>
      </div>

      <div className="flex items-baseline gap-2 mb-1.5">
        <h3 className="text-2xl sm:text-[26px] font-bold tracking-tight text-foreground tabular-nums">
          {prefix}
          {formatAsCurrency ? formatCurrency(value) : value}
          {suffix}
        </h3>
        {badge && (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${badgeStyle}`}>
            {badge}
          </span>
        )}
      </div>

      {progressPercent !== undefined && (
        <div className="w-full bg-secondary rounded-full h-1 mt-2.5 mb-2 overflow-hidden">
          <div 
            className="bg-primary h-1 rounded-full transition-all duration-500" 
            style={{ width: `${Math.min(100, Math.max(0, progressPercent))}%` }}
          />
        </div>
      )}

      <div className="flex items-center justify-between text-xs text-muted-foreground mt-2">
        <span className="truncate pr-1">{subtitle}</span>
        {delta && (
          <span className={`inline-flex items-center gap-1 font-semibold shrink-0 ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-destructive'}`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {delta.value > 0 ? `+${delta.value}%` : `${delta.value}%`} {delta.label}
          </span>
        )}
      </div>
    </div>
  );
}
