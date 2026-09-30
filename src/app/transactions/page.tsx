'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { TransactionModal } from '@/components/transactions/transaction-modal';
import { 
  useTransactions, 
  useCategories, 
  useAccounts, 
  useAddTransaction, 
  useUpdateTransaction,
  useToggleTransactionStatus,
  useDeleteTransaction 
} from '@/hooks/use-financial';
import { formatDateBR, toCents, fromCents } from '@/lib/financial/formatters';
import { usePrivacy } from '@/components/providers/privacy-provider';
import { usePeriod } from '@/components/providers/period-provider';
import { exportTransactionsToCSV } from '@/lib/financial/export-csv';
import { FinancialReportModal } from '@/components/reports/financial-report-modal';
import { 
  ReceiptText, 
  Search, 
  Filter, 
  Trash2, 
  Layers, 
  Repeat, 
  Plus, 
  Sparkles,
  Inbox,
  Upload,
  Edit2,
  CheckCircle2,
  Clock,
  Download,
  CheckSquare,
  Square,
  X,
  RotateCcw,
  FileText,
  Calendar,
  ArrowUpRight,
  ArrowDownRight
} from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { format, subDays } from 'date-fns';
import { Transaction } from '@/lib/supabase/types';

export default function TransactionsPage() {
  const { data: transactions = [], isLoading } = useTransactions();
  const { data: categories = [] } = useCategories();
  const { data: accounts = [] } = useAccounts();
  const { formatMoney } = usePrivacy();

  const addTransactionMutation = useAddTransaction();
  const updateTransactionMutation = useUpdateTransaction();
  const toggleStatusMutation = useToggleTransactionStatus();
  const deleteTransactionMutation = useDeleteTransaction();

  const { selectedMonth, setSelectedMonth } = usePeriod();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedType, setSelectedType] = useState('all');
  const [selectedStatus, setSelectedStatus] = useState('all');
  const [selectedPeriod, setSelectedPeriod] = useState<'all' | 'this_month' | 'last_30_days' | 'current_year'>('this_month');
  const [onlyInstallments, setOnlyInstallments] = useState(false);
  
  // Seleção múltipla para ações em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Atalhos de teclado ergonômicos: "/" para buscar e "N" para nova transação
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || isModalOpen || isReportModalOpen) {
        return;
      }
      if (e.key === '/') {
        e.preventDefault();
        searchInputRef.current?.focus();
      } else if (e.key === 'n' || e.key === 'N') {
        e.preventDefault();
        setEditingTransaction(null);
        setIsModalOpen(true);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isModalOpen, isReportModalOpen]);

  // Exclusão com ação de Desfazer (Undo)
  const handleDelete = async (item: Transaction) => {
    try {
      await deleteTransactionMutation.mutateAsync(item.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });

      toast.success(`Transação "${item.description}" excluída.`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              const { id: _, created_at: __, ...rest } = item as any;
              await addTransactionMutation.mutateAsync({ tx: rest, generateInstallments: false });
              toast.success('Transação restaurada com sucesso!');
            } catch {
              toast.error('Não foi possível restaurar a transação.');
            }
          },
        },
      });
    } catch {
      toast.error('Erro ao excluir transação.');
    }
  };

  // Alternar status com ação de Desfazer
  const handleToggleStatus = async (item: Transaction) => {
    try {
      await toggleStatusMutation.mutateAsync(item.id);
      const isNowCompleted = item.status !== 'completed';
      toast.success(
        isNowCompleted ? 'Transação marcada como Concluída/Paga!' : 'Transação marcada como Pendente!',
        {
          action: {
            label: 'Desfazer',
            onClick: async () => {
              await toggleStatusMutation.mutateAsync(item.id);
            },
          },
        }
      );
    } catch {
      toast.error('Erro ao alternar situação.');
    }
  };

  // Filtros aplicados
  const today = new Date();
  const currentMonthPrefix = format(today, 'yyyy-MM');
  const currentYearPrefix = format(today, 'yyyy');
  const thirtyDaysAgoStr = format(subDays(today, 30), 'yyyy-MM-dd');

  const filtered = transactions.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          (t.original_title && t.original_title.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || t.category_name === selectedCategory;
    const matchesType = selectedType === 'all' || t.type === selectedType;
    const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
    const matchesInstallment = !onlyInstallments || (t.installment_total && t.installment_total > 1);

    let matchesPeriod = true;
    if (selectedPeriod === 'this_month') {
      matchesPeriod = t.date.startsWith(selectedMonth);
    } else if (selectedPeriod === 'last_30_days') {
      matchesPeriod = t.date >= thirtyDaysAgoStr;
    } else if (selectedPeriod === 'current_year') {
      matchesPeriod = t.date.startsWith(currentYearPrefix);
    }

    return matchesSearch && matchesCategory && matchesType && matchesStatus && matchesInstallment && matchesPeriod;
  });

  const totalFilteredIncome = fromCents(
    filtered.reduce((sum, t) => sum + (t.type === 'income' ? toCents(t.amount) : 0), 0)
  );

  const totalFilteredExpense = fromCents(
    filtered.reduce((sum, t) => sum + (t.type === 'expense' ? toCents(t.amount) : 0), 0)
  );

  // Ações de Seleção em Lote
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filtered.length && filtered.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(t => t.id)));
    }
  };

  const handleToggleSelectItem = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  // Marcar todas as selecionadas como concluídas/pagas
  const handleBatchMarkCompleted = async () => {
    const idsToComplete = Array.from(selectedIds).filter((id) => {
      const t = transactions.find(item => item.id === id);
      return t && t.status !== 'completed';
    });

    if (idsToComplete.length === 0) {
      toast.info('Todas as transações selecionadas já estão concluídas.');
      return;
    }

    try {
      await Promise.all(idsToComplete.map(id => toggleStatusMutation.mutateAsync(id)));
      toast.success(`${idsToComplete.length} transações marcadas como pagas/recebidas!`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Erro ao atualizar transações em lote.');
    }
  };

  // Excluir todas as selecionadas em lote
  const handleBatchDelete = async () => {
    if (!confirm(`Deseja realmente excluir as ${selectedIds.size} transações selecionadas?`)) {
      return;
    }

    try {
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(idsToDelete.map(id => deleteTransactionMutation.mutateAsync(id)));
      toast.success(`${idsToDelete.length} transações excluídas com sucesso.`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Erro ao excluir transações em lote.');
    }
  };

  // Exportar para CSV
  const handleExport = () => {
    try {
      const dataToExport = (selectedIds.size > 0 
        ? filtered.filter(t => selectedIds.has(t.id)) 
        : filtered
      ).map(t => ({
        date: formatDateBR(t.date),
        description: t.description,
        category: t.category_name,
        account: accounts.find(a => a.id === t.account_id)?.name || 'Conta Padrão',
        type: t.type,
        amount: Number(t.amount),
        status: t.status,
        payment_method: t.payment_method
      }));

      exportTransactionsToCSV(dataToExport, `extrato_arrumabolso_${new Date().toISOString().slice(0, 10)}.csv`);
      toast.success(`Extrato com ${dataToExport.length} itens exportado com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao exportar CSV.');
    }
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar accounts={accounts} />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader 
          selectedMonth={selectedMonth}
          onMonthChange={setSelectedMonth}
          onOpenNewTransaction={() => {
            setEditingTransaction(null);
            setIsModalOpen(true);
          }} 
        />

        <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28 md:pb-12">
          {/* Top Title & Quick Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <ReceiptText className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Extrato & Transações
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Histórico financeiro completo, busca em tempo real, seleção em lote e exportação.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/70 transition-colors"
                title="Exportar itens atuais para planilha Excel/CSV"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Exportar CSV
              </button>

              <button
                onClick={() => setIsReportModalOpen(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/70 transition-colors"
                title="Gerar Relatório Executivo em PDF e Impressão"
              >
                <FileText className="w-3.5 h-3.5 text-primary" />
                Relatório PDF
              </button>

              <Link
                href="/import"
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/70 transition-colors"
              >
                <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                Importar Nubank
              </Link>

              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setIsModalOpen(true);
                }}
                className="interactive-tap inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-sm"
                title="Criar nova transação (Atalho: N)"
              >
                <Plus className="w-4 h-4" />
                Nova Transação
                <kbd className="hidden sm:inline-block ml-1 px-1.5 py-0.5 text-[9px] bg-black/20 rounded font-mono">N</kbd>
              </button>
            </div>
          </div>

          {/* Quick Summary Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Total de Entradas no Filtro</span>
              <span className="text-lg font-bold text-emerald-400 tabular-nums">
                +{formatMoney(totalFilteredIncome)}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Total de Saídas no Filtro</span>
              <span className="text-lg font-bold text-rose-400 tabular-nums">
                -{formatMoney(totalFilteredExpense)}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Saldo do Filtro</span>
              <span className={`text-lg font-bold tabular-nums ${totalFilteredIncome >= totalFilteredExpense ? 'text-foreground' : 'text-rose-400'}`}>
                {formatMoney(totalFilteredIncome - totalFilteredExpense)}
              </span>
            </div>
          </div>

          {/* Filter Chips - Pílulas de Acesso Rápido em 2 níveis */}
          <div className="space-y-2">
            {/* Linha 1: Período Rápido */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground font-medium mr-1.5 text-[11px]">
                <Calendar className="w-3 h-3 text-primary" />
                <span>Período:</span>
              </div>

              <button
                onClick={() => setSelectedPeriod('this_month')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedPeriod === 'this_month'
                    ? 'bg-primary/20 text-primary border-primary/40 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Este Mês
              </button>

              <button
                onClick={() => setSelectedPeriod('last_30_days')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedPeriod === 'last_30_days'
                    ? 'bg-primary/20 text-primary border-primary/40 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Últimos 30 Dias
              </button>

              <button
                onClick={() => setSelectedPeriod('current_year')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedPeriod === 'current_year'
                    ? 'bg-primary/20 text-primary border-primary/40 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Ano Atual
              </button>

              <button
                onClick={() => setSelectedPeriod('all')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedPeriod === 'all'
                    ? 'bg-primary/20 text-primary border-primary/40 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Todo o Histórico
              </button>
            </div>

            {/* Linha 2: Tipo & Situação */}
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-muted-foreground font-medium mr-1.5 text-[11px]">Tipo & Situação:</span>
              
              <button
                onClick={() => {
                  setSelectedType('all');
                  setSelectedStatus('all');
                }}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedType === 'all' && selectedStatus === 'all'
                    ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Todas ({transactions.length})
              </button>

              <button
                onClick={() => setSelectedType(selectedType === 'expense' ? 'all' : 'expense')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedType === 'expense'
                    ? 'bg-rose-500/15 text-rose-400 border-rose-500/30 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Despesas
              </button>

              <button
                onClick={() => setSelectedType(selectedType === 'income' ? 'all' : 'income')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedType === 'income'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Receitas
              </button>

              <div className="h-4 w-px bg-border/80 mx-1 hidden sm:block" />

              <button
                onClick={() => setSelectedStatus(selectedStatus === 'pending' ? 'all' : 'pending')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedStatus === 'pending'
                    ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Pendentes
              </button>

              <button
                onClick={() => setSelectedStatus(selectedStatus === 'completed' ? 'all' : 'completed')}
                className={`px-3 py-1 rounded-full transition-all text-xs font-medium border ${
                  selectedStatus === 'completed'
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                    : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
                }`}
              >
                Concluídas / Pagas
              </button>
            </div>
          </div>

          {/* Search and Secondary Dropdown Filters Bar */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col md:flex-row items-center gap-3">
            {/* Search Input */}
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
              <input
                ref={searchInputRef}
                type="text"
                placeholder="Buscar por descrição, estabelecimento... (Pressione '/' para buscar)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-9 py-2.5 rounded-xl border border-border/70 focus:outline-none focus:border-primary transition-colors"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  className="absolute right-3 top-2.5 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Dropdown Filters */}
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-secondary/40 text-foreground text-xs rounded-xl px-3 py-2.5 border border-border/70 focus:outline-none focus:border-primary cursor-pointer"
              >
                <option value="all">Todas as Categorias</option>
                {categories.map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>

              {/* Only Installments Toggle */}
              <label className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground cursor-pointer px-2">
                <input
                  type="checkbox"
                  checked={onlyInstallments}
                  onChange={(e) => setOnlyInstallments(e.target.checked)}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                />
                <span>Apenas Parceladas</span>
              </label>
            </div>
          </div>

          {/* Counter message */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Exibindo <strong className="text-foreground">{filtered.length}</strong> de {transactions.length} transações
            </span>
            {selectedIds.size > 0 && (
              <span className="text-emerald-400 font-semibold">
                {selectedIds.size} selecionada{selectedIds.size === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Table */}
          <div className="rounded-2xl bg-card border border-border/70 shadow-sm overflow-hidden">
            {filtered.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-14 h-14 rounded-2xl bg-secondary/70 flex items-center justify-center mb-3 text-muted-foreground">
                  <Inbox className="w-7 h-7" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">
                  {transactions.length === 0 ? 'Nenhuma movimentação cadastrada ainda' : 'Nenhuma transação encontrada com os filtros atuais'}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  {transactions.length === 0 
                    ? 'Comece adicionando uma receita ou despesa manual ou importe seu extrato bancário.'
                    : 'Tente alterar o período, remover os termos digitados na busca ou redefinir os filtros aplicados.'}
                </p>
                
                <div className="flex flex-wrap items-center justify-center gap-2 mt-4">
                  {transactions.length === 0 ? (
                    <>
                      <button
                        onClick={() => {
                          setEditingTransaction(null);
                          setIsModalOpen(true);
                        }}
                        className="interactive-tap inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Nova Transação
                      </button>
                      <Link
                        href="/import"
                        className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border"
                      >
                        <Upload className="w-3.5 h-3.5 text-muted-foreground" />
                        Importar Nubank
                      </Link>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => {
                          setSearchTerm('');
                          setSelectedCategory('all');
                          setSelectedType('all');
                          setSelectedStatus('all');
                          setSelectedPeriod('all');
                          setOnlyInstallments(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors"
                      >
                        <RotateCcw className="w-3.5 h-3.5 text-primary" />
                        Limpar todos os filtros
                      </button>
                      <button
                        onClick={() => {
                          setEditingTransaction(null);
                          setIsModalOpen(true);
                        }}
                        className="interactive-tap inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold shadow-sm"
                      >
                        <Plus className="w-4 h-4" />
                        Nova Transação
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <>
                {/* Desktop Table (Visible on md and up) */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full min-w-[640px] text-left text-xs">
                    <thead className="bg-secondary/40 border-b border-border/70 text-muted-foreground uppercase text-[10px] font-bold tracking-wider">
                      <tr>
                        <th className="py-3 px-4 w-10">
                          <button
                            type="button"
                            onClick={handleToggleSelectAll}
                            className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                            title="Selecionar / Desmarcar todos"
                          >
                            {selectedIds.size > 0 && selectedIds.size === filtered.length ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-4">Descrição</th>
                        <th className="py-3 px-4">Categoria</th>
                        <th className="py-3 px-4">Data</th>
                        <th className="py-3 px-4">Valor</th>
                        <th className="py-3 px-4">Situação</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filtered.map((item) => {
                        const isIncome = item.type === 'income';
                        const isCompleted = item.status === 'completed';
                        const isSelected = selectedIds.has(item.id);

                        return (
                          <tr 
                            key={item.id} 
                            className={`hover:bg-secondary/30 transition-colors group ${
                              isSelected ? 'bg-primary/5' : ''
                            }`}
                          >
                            <td className="py-3.5 px-4">
                              <button
                                type="button"
                                onClick={() => handleToggleSelectItem(item.id)}
                                className="flex items-center justify-center text-muted-foreground hover:text-foreground"
                              >
                                {isSelected ? (
                                  <CheckSquare className="w-4 h-4 text-emerald-400" />
                                ) : (
                                  <Square className="w-4 h-4" />
                                )}
                              </button>
                            </td>
                            <td className="py-3.5 px-4 font-semibold text-foreground">
                              {item.description}
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {item.installment_total && item.installment_total > 1 && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-medium">
                                    <Layers className="w-2.5 h-2.5" />
                                    {item.installment_current}/{item.installment_total}
                                  </span>
                                )}
                                {item.is_recurring && (
                                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.2 rounded bg-secondary text-muted-foreground font-medium">
                                    <Repeat className="w-2.5 h-2.5" />
                                    Fixo
                                  </span>
                                )}
                                {item.payment_method && (
                                  <span className="text-[10px] text-muted-foreground/70">
                                    • {item.payment_method}
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="py-3.5 px-4 text-muted-foreground">
                              {item.category_name}
                            </td>
                            <td className="py-3.5 px-4 text-muted-foreground">
                              {formatDateBR(item.date)}
                            </td>
                            <td className={`py-3.5 px-4 font-bold tabular-nums ${
                              isIncome 
                                ? 'text-emerald-400' 
                                : item.type === 'expense' 
                                ? 'text-rose-400' 
                                : 'text-primary'
                            }`}>
                              {isIncome ? '+' : item.type === 'expense' ? '-' : ''}
                              {formatMoney(Number(item.amount))}
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => handleToggleStatus(item)}
                                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                                  isCompleted
                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                                    : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20'
                                }`}
                                title="Clique para alternar o status (com Desfazer)"
                              >
                                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                <span>{isCompleted ? (isIncome ? 'Recebido' : 'Pago') : (isIncome ? 'A Receber' : 'A Pagar')}</span>
                              </button>
                            </td>
                            <td className="py-3.5 px-4 text-right">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    setEditingTransaction(item);
                                    setIsModalOpen(true);
                                  }}
                                  className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
                                  title="Editar transação"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                                  title="Excluir transação"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards Feed (Visible on mobile screens) */}
                <div className="md:hidden divide-y divide-border/60">
                  {filtered.map((item) => {
                    const isIncome = item.type === 'income';
                    const isCompleted = item.status === 'completed';
                    const isSelected = selectedIds.has(item.id);

                    return (
                      <div
                        key={item.id}
                        className={`p-3.5 flex flex-col gap-2.5 transition-colors ${
                          isSelected ? 'bg-primary/5' : ''
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex items-start gap-2.5 min-w-0">
                            <button
                              type="button"
                              onClick={() => handleToggleSelectItem(item.id)}
                              className="mt-0.5 text-muted-foreground hover:text-foreground shrink-0"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4 h-4 text-emerald-400" />
                              ) : (
                                <Square className="w-4 h-4" />
                              )}
                            </button>

                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                              isIncome ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                              {isIncome ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            </div>

                            <div className="min-w-0">
                              <span className="font-bold text-xs text-foreground truncate block">
                                {item.description}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                <span>{item.category_name}</span>
                                <span>•</span>
                                <span>{formatDateBR(item.date)}</span>
                                {item.installment_total && item.installment_total > 1 && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-semibold">
                                    {item.installment_current}/{item.installment_total}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className={`font-bold text-sm tabular-nums block ${
                              isIncome ? 'text-emerald-400' : 'text-rose-400'
                            }`}>
                              {isIncome ? '+' : '-'}{formatMoney(Number(item.amount))}
                            </span>
                            <button
                              onClick={() => handleToggleStatus(item)}
                              className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              <span>{isCompleted ? (isIncome ? 'Recebido' : 'Pago') : (isIncome ? 'A Receber' : 'A Pagar')}</span>
                            </button>
                          </div>
                        </div>

                        {/* Mobile Actions Bar */}
                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40 text-[11px]">
                          <button
                            onClick={() => {
                              setEditingTransaction(item);
                              setIsModalOpen(true);
                            }}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-secondary/60 hover:bg-secondary text-foreground text-[10px] font-medium transition-colors"
                          >
                            <Edit2 className="w-3 h-3" />
                            Editar
                          </button>
                          <button
                            onClick={() => handleDelete(item)}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-[10px] font-medium transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Excluir
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Floating Bottom Toolbar for Batch Actions */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 bg-card border border-border shadow-2xl rounded-2xl px-5 py-3 z-40 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 max-w-lg w-full">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-emerald-500/20 text-emerald-400 font-bold text-xs flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-foreground">
              selecionada{selectedIds.size === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchMarkCompleted}
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-black text-xs font-bold transition-all shadow-sm"
            >
              Marcar Pagas
            </button>
            <button
              onClick={handleBatchDelete}
              className="px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all"
            >
              Excluir
            </button>
            <button
              onClick={() => setSelectedIds(new Set())}
              className="p-1.5 text-muted-foreground hover:text-foreground rounded-lg"
              title="Desmarcar todas"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      <MobileBottomNav onOpenNewTransaction={() => setIsModalOpen(true)} />

      {/* Transaction Modal */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        categories={categories}
        accounts={accounts}
        transactionToEdit={editingTransaction}
        onSave={async (tx, gen) => {
          await addTransactionMutation.mutateAsync({ tx, generateInstallments: gen });
        }}
        onUpdate={async (tx) => {
          await updateTransactionMutation.mutateAsync(tx);
        }}
      />

      {/* Financial Executive Report Modal */}
      <FinancialReportModal
        isOpen={isReportModalOpen}
        onClose={() => setIsReportModalOpen(false)}
        transactions={filtered}
        accounts={accounts}
        categories={categories}
      />
    </div>
  );
}
