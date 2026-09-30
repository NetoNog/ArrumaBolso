'use client';

import React, { useRef } from 'react';
import { 
  X, 
  Printer, 
  Download, 
  FileText, 
  TrendingUp, 
  TrendingDown, 
  Calendar,
  Sparkles,
  CheckCircle2,
  PieChart as PieIcon
} from 'lucide-react';
import { Transaction, AccountAndCard, Category } from '@/lib/supabase/types';
import { exportTransactionsToCSV } from '@/lib/financial/export-csv';
import { formatCurrency, formatDateBR } from '@/lib/financial/formatters';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

interface FinancialReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  transactions: Transaction[];
  accounts: AccountAndCard[];
  categories: Category[];
  selectedMonth?: string;
  userName?: string;
}

export function FinancialReportModal({
  isOpen,
  onClose,
  transactions,
  accounts,
  categories,
  selectedMonth,
  userName = 'Usuário ArrumaBolso'
}: FinancialReportModalProps) {
  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  const currentMonthKey = selectedMonth || format(new Date(), 'yyyy-MM');
  const [yearStr, monthStr] = currentMonthKey.split('-');
  const dateObj = new Date(parseInt(yearStr, 10), parseInt(monthStr, 10) - 1, 1);
  const formattedPeriod = format(dateObj, "MMMM 'de' yyyy", { locale: ptBR });
  const capitalizedPeriod = formattedPeriod.charAt(0).toUpperCase() + formattedPeriod.slice(1);

  // Filtra transações do período
  const periodTransactions = transactions.filter(t => t.date.startsWith(currentMonthKey));

  const totalIncome = periodTransactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const totalExpense = periodTransactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const netResult = totalIncome - totalExpense;
  const savingsRate = totalIncome > 0 ? Math.max(0, (netResult / totalIncome) * 100) : 0;

  // Quebra por categoria de despesa
  const categoryBreakdown = new Map<string, number>();
  periodTransactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      const name = t.category_name || 'Geral';
      categoryBreakdown.set(name, (categoryBreakdown.get(name) || 0) + Number(t.amount));
    });

  const sortedCategories = Array.from(categoryBreakdown.entries())
    .map(([name, amount]) => ({
      name,
      amount,
      percentage: totalExpense > 0 ? (amount / totalExpense) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    try {
      const items = periodTransactions.map(t => {
        const acc = accounts.find(a => a.id === t.account_id);
        return {
          date: t.date,
          description: t.description,
          category: t.category_name || 'Geral',
          account: acc ? acc.name : 'Conta Principal',
          type: t.type,
          amount: Number(t.amount),
          status: t.status,
          payment_method: t.payment_method
        };
      });

      exportTransactionsToCSV(items, `relatorio_arrumabolso_${currentMonthKey}.csv`);
      toast.success('Relatório CSV exportado com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao exportar.');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/85 backdrop-blur-md">
      <div className="bg-card border border-border/80 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in-0 duration-200">
        {/* Modal Top Bar (Screen Only) */}
        <div className="px-6 py-4 border-b border-border/70 flex items-center justify-between bg-secondary/30 print:hidden">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-foreground">Relatório Financeiro Executivo</h3>
              <p className="text-[11px] text-muted-foreground">Competência: {capitalizedPeriod}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/70 transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Exportar Excel</span>
            </button>
            <button
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold transition-all shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Printable Document Body */}
        <div ref={printRef} className="p-6 sm:p-10 overflow-y-auto space-y-8 print:p-0 print:space-y-6">
          {/* Document Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-border/70 gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
                  Arruma<span className="text-emerald-400">Bolso</span>
                </span>
                <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-md bg-secondary text-muted-foreground border border-border/60">
                  Relatório Oficial
                </span>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Demonstrativo de Fluxo de Caixa e Fechamento Mensal
              </p>
            </div>

            <div className="text-left sm:text-right text-xs space-y-0.5">
              <p className="text-foreground font-semibold">Titular: <span className="font-bold">{userName}</span></p>
              <p className="text-muted-foreground">Competência: <strong>{capitalizedPeriod}</strong></p>
              <p className="text-[11px] text-muted-foreground">
                Emitido em: {format(new Date(), "dd/MM/yyyy 'às' HH:mm")}
              </p>
            </div>
          </div>

          {/* KPI Summary Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">Total de Receitas</span>
              <span className="text-lg sm:text-xl font-extrabold text-emerald-400">
                {formatCurrency(totalIncome)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">Total de Despesas</span>
              <span className="text-lg sm:text-xl font-extrabold text-rose-400">
                {formatCurrency(totalExpense)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">Resultado Líquido</span>
              <span className={`text-lg sm:text-xl font-extrabold ${netResult >= 0 ? 'text-foreground' : 'text-rose-400'}`}>
                {netResult >= 0 ? '+' : ''}{formatCurrency(netResult)}
              </span>
            </div>

            <div className="p-4 rounded-xl bg-secondary/30 border border-border/60 space-y-1">
              <span className="text-[11px] text-muted-foreground block font-medium">Taxa de Poupança</span>
              <span className="text-lg sm:text-xl font-extrabold text-cyan-400">
                {savingsRate.toFixed(1)}%
              </span>
            </div>
          </div>

          {/* Category Breakdown */}
          {sortedCategories.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <PieIcon className="w-3.5 h-3.5" />
                Despesas por Categoria (Maiores Gastos)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sortedCategories.slice(0, 8).map((cat, idx) => (
                  <div key={idx} className="p-3 rounded-lg bg-secondary/20 border border-border/50 space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-semibold text-foreground">{cat.name}</span>
                      <span className="font-bold text-foreground">
                        {formatCurrency(cat.amount)} ({cat.percentage.toFixed(0)}%)
                      </span>
                    </div>
                    <div className="w-full bg-secondary h-1.5 rounded-full overflow-hidden">
                      <div 
                        className="bg-primary h-full rounded-full" 
                        style={{ width: `${cat.percentage}%` }} 
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Full Transaction Statement Table */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
              Extrato Analítico de Lançamentos ({periodTransactions.length} movimentações)
            </h4>
            <div className="border border-border/60 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-secondary/40 border-b border-border/60 text-muted-foreground font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Data</th>
                    <th className="py-2.5 px-3">Descrição</th>
                    <th className="py-2.5 px-3">Categoria</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Valor</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {periodTransactions.length > 0 ? (
                    periodTransactions.map(t => (
                      <tr key={t.id} className="hover:bg-secondary/10 transition-colors">
                        <td className="py-2 px-3 text-muted-foreground font-mono text-[11px]">
                          {formatDateBR(t.date)}
                        </td>
                        <td className="py-2 px-3 font-medium text-foreground">
                          {t.description}
                        </td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {t.category_name || 'Geral'}
                        </td>
                        <td className="py-2 px-3">
                          <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-md font-semibold ${
                            t.status === 'completed' 
                              ? 'bg-emerald-500/10 text-emerald-400' 
                              : 'bg-amber-500/10 text-amber-400'
                          }`}>
                            {t.status === 'completed' ? 'Concluído' : 'Pendente'}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-bold ${
                          t.type === 'income' ? 'text-emerald-400' : 'text-foreground'
                        }`}>
                          {t.type === 'income' ? '+' : '-'} {formatCurrency(Number(t.amount))}
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        Nenhuma movimentação registrada no período selecionado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Document Footer */}
          <div className="pt-6 border-t border-border/60 flex flex-col sm:flex-row items-center justify-between gap-2 text-[10px] text-muted-foreground">
            <span>ArrumaBolso Gestão Financeira Pessoal • Relatório Gerado Automaticamente</span>
            <span>Documento emitido para fins de conferência e controle pessoal</span>
          </div>
        </div>
      </div>
    </div>
  );
}
