'use client';

import React, { useState } from 'react';
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
import { 
  ArrowDownRight, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle,
  Edit2, 
  Trash2, 
  CreditCard,
  DollarSign, 
  Calendar,
  Layers,
  Repeat,
  Inbox,
  Download,
  CheckSquare,
  Square,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Transaction } from '@/lib/supabase/types';

export default function ExpensesPage() {
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
  const [selectedStatus, setSelectedStatus] = useState<'all' | 'completed' | 'pending'>('all');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Seleção múltipla para ações em lote
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  // Filtra despesas do mês selecionado
  const expenses = transactions.filter(t => t.type === 'expense' && t.date.startsWith(selectedMonth));

  const totalExpenseInCents = expenses.reduce((sum, t) => sum + toCents(t.amount), 0);
  const paidInCents = expenses.filter(t => t.status === 'completed').reduce((sum, t) => sum + toCents(t.amount), 0);
  const pendingInCents = expenses.filter(t => t.status === 'pending').reduce((sum, t) => sum + toCents(t.amount), 0);

  const totalExpense = fromCents(totalExpenseInCents);
  const paidExpense = fromCents(paidInCents);
  const pendingExpense = fromCents(pendingInCents);

  // Filtragem da tabela
  const filteredExpenses = expenses.filter(t => {
    const matchesSearch = t.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = selectedStatus === 'all' || t.status === selectedStatus;
    const matchesCategory = selectedCategory === 'all' || t.category_name === selectedCategory;
    return matchesSearch && matchesStatus && matchesCategory;
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const handleToggleStatus = async (item: Transaction) => {
    try {
      await toggleStatusMutation.mutateAsync(item.id);
      const isNowPaid = item.status !== 'completed';
      toast.success(isNowPaid ? 'Despesa marcada como Paga!' : 'Despesa marcada como A Pagar!', {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            await toggleStatusMutation.mutateAsync(item.id);
          },
        },
      });
    } catch {
      toast.error('Erro ao atualizar situação.');
    }
  };

  const handleDelete = async (item: Transaction) => {
    try {
      await deleteTransactionMutation.mutateAsync(item.id);
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });

      toast.success(`Despesa "${item.description}" excluída.`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              const { id: _, created_at: __, ...rest } = item as any;
              await addTransactionMutation.mutateAsync({ tx: rest, generateInstallments: false });
              toast.success('Despesa restaurada com sucesso!');
            } catch {
              toast.error('Não foi possível restaurar a despesa.');
            }
          },
        },
      });
    } catch {
      toast.error('Erro ao excluir despesa.');
    }
  };

  // Seleção em lote
  const handleToggleSelectAll = () => {
    if (selectedIds.size === filteredExpenses.length && filteredExpenses.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredExpenses.map(t => t.id)));
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

  const handleBatchMarkPaid = async () => {
    const idsToPay = Array.from(selectedIds).filter((id) => {
      const t = expenses.find(item => item.id === id);
      return t && t.status !== 'completed';
    });

    if (idsToPay.length === 0) {
      toast.info('Todas as despesas selecionadas já estão pagas.');
      return;
    }

    try {
      await Promise.all(idsToPay.map(id => toggleStatusMutation.mutateAsync(id)));
      toast.success(`${idsToPay.length} despesas marcadas como pagas!`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Erro ao atualizar despesas em lote.');
    }
  };

  const handleBatchDelete = async () => {
    if (!confirm(`Deseja realmente excluir as ${selectedIds.size} despesas selecionadas?`)) {
      return;
    }

    try {
      const idsToDelete = Array.from(selectedIds);
      await Promise.all(idsToDelete.map(id => deleteTransactionMutation.mutateAsync(id)));
      toast.success(`${idsToDelete.length} despesas excluídas com sucesso.`);
      setSelectedIds(new Set());
    } catch {
      toast.error('Erro ao excluir despesas em lote.');
    }
  };

  const handleExport = () => {
    try {
      const dataToExport = (selectedIds.size > 0 
        ? filteredExpenses.filter(t => selectedIds.has(t.id)) 
        : filteredExpenses
      ).map(t => ({
        date: formatDateBR(t.date),
        description: t.description,
        category: t.category_name,
        account: accounts.find(a => a.id === t.account_id)?.name || 'Conta Padrão',
        type: 'expense',
        amount: Number(t.amount),
        status: t.status,
        payment_method: t.payment_method
      }));

      exportTransactionsToCSV(dataToExport, `despesas_arrumabolso_${selectedMonth}.csv`);
      toast.success(`Relatório com ${dataToExport.length} despesas exportado com sucesso!`);
    } catch (err: any) {
      toast.error(err.message || 'Erro ao exportar despesas.');
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
          {/* Top Title & Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center">
                  <ArrowDownRight className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Despesas & Saídas
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Controle detalhado de tudo o que sai do seu bolso: pagas, pendentes e parcelamentos.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                onClick={handleExport}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border/70 transition-colors"
                title="Exportar despesas do mês em CSV/Excel"
              >
                <Download className="w-3.5 h-3.5 text-emerald-400" />
                Exportar CSV
              </button>

              <button
                onClick={() => {
                  setEditingTransaction(null);
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-sm transition-all active:scale-[0.98]"
              >
                <Plus className="w-4 h-4" />
                Nova Despesa
              </button>
            </div>
          </div>

          {/* 3 Summary KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Total Previsto no Mês</span>
              <span className="text-xl font-bold text-rose-400">
                {formatMoney(totalExpense)}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-xs">
              <span className="text-[11px] text-muted-foreground font-medium block">Já Pago</span>
              <span className="text-xl font-bold text-foreground">
                {formatMoney(paidExpense)}
              </span>
            </div>
            <div className="p-4 rounded-xl bg-card border border-border/70 shadow-xs">
              <span className="text-[11px] text-muted-foreground font-medium block">A Pagar (Pendente)</span>
              <span className="text-xl font-bold text-amber-400">
                {formatMoney(pendingExpense)}
              </span>
            </div>
          </div>

          {/* Filter Chips Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span className="text-muted-foreground font-medium mr-1 text-[11px]">Situação:</span>
            <button
              onClick={() => setSelectedStatus('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedStatus === 'all'
                  ? 'bg-primary/15 text-primary border-primary/30 font-semibold'
                  : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
              }`}
            >
              Todas ({expenses.length})
            </button>
            <button
              onClick={() => setSelectedStatus('pending')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedStatus === 'pending'
                  ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 font-semibold'
                  : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
              }`}
            >
              A Pagar
            </button>
            <button
              onClick={() => setSelectedStatus('completed')}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                selectedStatus === 'completed'
                  ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 font-semibold'
                  : 'bg-card text-muted-foreground border-border/70 hover:text-foreground'
              }`}
            >
              Pagas
            </button>
          </div>

          {/* Search and Category Filter Bar */}
          <div className="p-4 rounded-2xl bg-card border border-border/70 shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-emerald-400 absolute left-3 top-3" />
              <input
                type="text"
                placeholder="Buscar despesa por nome, estabelecimento..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-9 py-2.5 rounded-xl border border-border/70 focus:outline-none focus:border-rose-500 transition-colors"
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

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-secondary/40 text-foreground text-xs rounded-xl px-3 py-2.5 border border-border/70 focus:outline-none focus:border-rose-500 cursor-pointer w-full md:w-auto"
              >
                <option value="all">Todas Categorias</option>
                {categories.filter(c => c.type === 'expense').map(c => (
                  <option key={c.id} value={c.name}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Counter info */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <span>
              Exibindo <strong className="text-foreground">{filteredExpenses.length}</strong> de {expenses.length} despesas
            </span>
            {selectedIds.size > 0 && (
              <span className="text-rose-400 font-semibold">
                {selectedIds.size} selecionada{selectedIds.size === 1 ? '' : 's'}
              </span>
            )}
          </div>

          {/* Expenses Table */}
          <div className="rounded-2xl bg-card border border-border/70 shadow-sm overflow-hidden">
            {filteredExpenses.length === 0 ? (
              <div className="p-12 text-center flex flex-col items-center justify-center">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                  <Inbox className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-semibold text-foreground">Nenhuma despesa encontrada</h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                  Não há lançamentos de despesa correspondentes aos filtros neste mês.
                </p>
                <button
                  onClick={() => {
                    setEditingTransaction(null);
                    setIsModalOpen(true);
                  }}
                  className="mt-4 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-semibold shadow-sm transition-all"
                >
                  + Cadastrar Despesa
                </button>
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
                            {selectedIds.size > 0 && selectedIds.size === filteredExpenses.length ? (
                              <CheckSquare className="w-4 h-4 text-emerald-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        </th>
                        <th className="py-3 px-4">Descrição</th>
                        <th className="py-3 px-4">Categoria</th>
                        <th className="py-3 px-4">Data / Vencimento</th>
                        <th className="py-3 px-4">Valor</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4 text-right">Ações</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredExpenses.map((item) => {
                        const isCompleted = item.status === 'completed';
                        const isSelected = selectedIds.has(item.id);
                        const isOverdue = !isCompleted && item.date < todayStr;
                        const isDueToday = !isCompleted && item.date === todayStr;

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
                              <span>{formatDateBR(item.date)}</span>
                              {isOverdue && (
                                <span className="block text-[10px] text-rose-400 font-bold mt-0.5">
                                  Em atraso
                                </span>
                              )}
                              {isDueToday && (
                                <span className="block text-[10px] text-amber-400 font-bold mt-0.5">
                                  Vence hoje!
                                </span>
                              )}
                            </td>
                            <td className="py-3.5 px-4 font-bold text-rose-400">
                              -{formatMoney(Number(item.amount))}
                            </td>
                            <td className="py-3.5 px-4">
                              <button
                                onClick={() => handleToggleStatus(item)}
                                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all ${
                                  isCompleted
                                    ? 'bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25 border border-emerald-500/20'
                                    : isOverdue
                                    ? 'bg-rose-500/15 text-rose-400 hover:bg-rose-500/25 border border-rose-500/20'
                                    : 'bg-amber-500/15 text-amber-400 hover:bg-amber-500/25 border border-amber-500/20'
                                }`}
                                title="Clique para alternar se já foi pago (com Desfazer)"
                              >
                                {isCompleted ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                                <span>{isCompleted ? 'Pago' : isOverdue ? 'Atrasado' : 'A Pagar'}</span>
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
                                  title="Editar despesa"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  onClick={() => handleDelete(item)}
                                  className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                                  title="Excluir despesa"
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
                  {filteredExpenses.map((item) => {
                    const isCompleted = item.status === 'completed';
                    const isSelected = selectedIds.has(item.id);
                    const isOverdue = !isCompleted && item.date < todayStr;
                    const isDueToday = !isCompleted && item.date === todayStr;

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

                            <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-400 flex items-center justify-center shrink-0 mt-0.5">
                              <ArrowDownRight className="w-4 h-4" />
                            </div>

                            <div className="min-w-0">
                              <span className="font-bold text-xs text-foreground truncate block">
                                {item.description}
                              </span>
                              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                                <span>{item.category_name}</span>
                                <span>•</span>
                                <span className={isOverdue ? 'text-rose-400 font-bold' : isDueToday ? 'text-amber-400 font-bold' : ''}>
                                  {formatDateBR(item.date)}
                                </span>
                                {item.installment_total && item.installment_total > 1 && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-indigo-500/10 text-indigo-400 font-semibold">
                                    {item.installment_current}/{item.installment_total}
                                  </span>
                                )}
                                {item.is_recurring && (
                                  <span className="text-[9px] px-1 py-0.2 rounded bg-secondary text-muted-foreground">
                                    Fixo
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="font-bold text-sm text-rose-400 tabular-nums block">
                              -{formatMoney(Number(item.amount))}
                            </span>
                            <button
                              onClick={() => handleToggleStatus(item)}
                              className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all ${
                                isCompleted
                                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/20'
                                  : isOverdue
                                  ? 'bg-rose-500/15 text-rose-400 border border-rose-500/20'
                                  : 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              {isCompleted ? <CheckCircle2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              <span>{isCompleted ? 'Pago' : isOverdue ? 'Atrasado' : 'A Pagar'}</span>
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

      {/* Floating Batch Actions Bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-20 md:bottom-6 inset-x-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 bg-card border border-border shadow-2xl rounded-2xl px-5 py-3 z-40 flex items-center justify-between gap-4 animate-in slide-in-from-bottom-5 max-w-lg w-full">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-rose-500/20 text-rose-400 font-bold text-xs flex items-center justify-center">
              {selectedIds.size}
            </span>
            <span className="text-xs font-semibold text-foreground">
              selecionada{selectedIds.size === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleBatchMarkPaid}
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

      {/* Modal de Despesa */}
      <TransactionModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingTransaction(null);
        }}
        categories={categories}
        accounts={accounts}
        transactionToEdit={editingTransaction}
        initialType="expense"
        onSave={async (tx, gen) => {
          await addTransactionMutation.mutateAsync({ tx, generateInstallments: gen });
        }}
        onUpdate={async (tx) => {
          await updateTransactionMutation.mutateAsync(tx);
        }}
      />
    </div>
  );
}
