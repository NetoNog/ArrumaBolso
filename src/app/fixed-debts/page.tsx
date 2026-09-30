'use client';

import React, { useState, useMemo } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { 
  useFixedExpenses, 
  useAddFixedExpense, 
  useDeleteFixedExpense,
  useDebts, 
  useAddDebt, 
  useDeleteDebt, 
  useAmortizeDebt,
  useAccounts, 
  useCategories, 
  useProfile,
  useAddTransaction,
  useTransactions
} from '@/hooks/use-financial';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';
import { 
  Repeat, 
  CreditCard, 
  Plus, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  Trash2, 
  Clock, 
  DollarSign, 
  Building2, 
  TrendingDown,
  Sparkles,
  Layers,
  X,
  Inbox,
  Filter,
  Check,
  ArrowRight,
  ShieldCheck,
  CheckSquare2,
  ListFilter,
  CheckCheck
} from 'lucide-react';
import { toast } from 'sonner';
import { usePrivacy } from '@/components/providers/privacy-provider';
import { usePeriod } from '@/components/providers/period-provider';
import { format, getDate, getDaysInMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function FixedDebtsPage() {
  const { data: fixedExpenses = [] } = useFixedExpenses();
  const { data: debts = [] } = useDebts();
  const { data: accounts = [] } = useAccounts();
  const { data: categories = [] } = useCategories();
  const { data: transactions = [] } = useTransactions();
  const { data: profile } = useProfile();
  const { formatMoney } = usePrivacy();

  const addFixedMutation = useAddFixedExpense();
  const deleteFixedMutation = useDeleteFixedExpense();
  const addDebtMutation = useAddDebt();
  const deleteDebtMutation = useDeleteDebt();
  const amortizeDebtMutation = useAmortizeDebt();
  const addTransactionMutation = useAddTransaction();

  const [activeTab, setActiveTab] = useState<'fixed' | 'debts'>('fixed');

  // Mês de referência atual para checklist
  const { selectedMonth, setSelectedMonth } = usePeriod();

  // Subvisão de Mensalidades: Cards ou Cronograma Semanal
  const [monthlyView, setMonthlyView] = useState<'cards' | 'schedule'>('cards');

  // Filtro de status de pagamento: todos, pendentes, pagos
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'paid'>('all');

  // Modais
  const [isFixedModalOpen, setIsFixedModalOpen] = useState(false);
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [amortizeModalDebt, setAmortizeModalDebt] = useState<any | null>(null);

  // Modal de Baixa Rápida / Pagar Mensalidade
  const [quickPayItem, setQuickPayItem] = useState<any | null>(null);
  const [quickPayAmount, setQuickPayAmount] = useState('');
  const [quickPayAccountId, setQuickPayAccountId] = useState('');
  const [quickPayDate, setQuickPayDate] = useState(() => format(new Date(), 'yyyy-MM-dd'));
  const [isSubmittingQuickPay, setIsSubmittingQuickPay] = useState(false);

  // Form Gasto Fixo
  const [fixedName, setFixedName] = useState('');
  const [fixedAmount, setFixedAmount] = useState('');
  const [fixedDueDay, setFixedDueDay] = useState(5);
  const [fixedCategoryId, setFixedCategoryId] = useState('');
  const [fixedAccountId, setFixedAccountId] = useState('');

  // Form Dívida
  const [debtTitle, setDebtTitle] = useState('');
  const [debtCreditor, setDebtCreditor] = useState('');
  const [debtTotal, setDebtTotal] = useState('');
  const [debtMonthly, setDebtMonthly] = useState('');
  const [debtTotalInstallments, setDebtTotalInstallments] = useState(12);
  const [debtPaidInstallments, setDebtPaidInstallments] = useState(0);
  const [debtDueDay, setDebtDueDay] = useState(10);

  // Amortizar Form
  const [amortizeAmount, setAmortizeAmount] = useState('');
  const [amortizeAccountId, setAmortizeAccountId] = useState('');

  // Transações do mês selecionado
  const monthTransactions = useMemo(() => {
    return transactions.filter(t => t.date.startsWith(selectedMonth));
  }, [transactions, selectedMonth]);

  // Contas disponíveis para débito
  const checkingAccounts = useMemo(() => {
    return accounts.filter(a => a.type === 'checking' || a.type === 'cash' || a.type === 'credit_card');
  }, [accounts]);

  // Cruzamento de cada Gasto Fixo com transações do mês para detecção de pagamento
  const enrichedFixedExpenses = useMemo(() => {
    const today = new Date().getDate();

    return fixedExpenses.map((item) => {
      const normName = item.name.toLowerCase().trim();

      // Procura transação correspondente no mês
      const matchingTx = monthTransactions.find(t => {
        if (t.type !== 'expense') return false;
        const desc = (t.description || '').toLowerCase();
        return desc.includes(normName) || normName.includes(desc);
      });

      const isPaid = Boolean(matchingTx);
      const diffDays = item.due_day - today;
      const isDueToday = diffDays === 0;
      const isOverdue = diffDays < 0 && !isPaid;
      const isDueSoon = diffDays > 0 && diffDays <= 3 && !isPaid;

      return {
        ...item,
        isPaid,
        paidDate: matchingTx ? matchingTx.date : null,
        paidAmount: matchingTx ? Number(matchingTx.amount) : null,
        isDueToday,
        isOverdue,
        isDueSoon,
        diffDays
      };
    });
  }, [fixedExpenses, monthTransactions]);

  // Itens filtrados pelo status (todos, pendentes, pagos)
  const filteredFixedExpenses = useMemo(() => {
    if (statusFilter === 'pending') {
      return enrichedFixedExpenses.filter(e => !e.isPaid);
    }
    if (statusFilter === 'paid') {
      return enrichedFixedExpenses.filter(e => e.isPaid);
    }
    return enrichedFixedExpenses;
  }, [enrichedFixedExpenses, statusFilter]);

  // Cálculos Executivos de Mensalidades do Mês
  const totalMonthlyFixed = useMemo(() => {
    return fixedExpenses
      .filter(f => f.is_active)
      .reduce((sum, f) => sum + Number(f.amount), 0);
  }, [fixedExpenses]);

  const totalPaidThisMonth = useMemo(() => {
    return enrichedFixedExpenses
      .filter(f => f.isPaid)
      .reduce((sum, f) => sum + Number(f.amount), 0);
  }, [enrichedFixedExpenses]);

  const totalPendingThisMonth = Math.max(0, totalMonthlyFixed - totalPaidThisMonth);
  const liquidationPercentage = totalMonthlyFixed > 0 ? (totalPaidThisMonth / totalMonthlyFixed) * 100 : 0;
  const paidCount = enrichedFixedExpenses.filter(f => f.isPaid).length;

  // Organização Semanal (Cronograma dos 31 dias)
  const weeklySchedule = useMemo(() => {
    const weeks = [
      { id: 1, label: 'Semana 1', range: 'Dias 01 a 07', min: 1, max: 7 },
      { id: 2, label: 'Semana 2', range: 'Dias 08 a 14', min: 8, max: 14 },
      { id: 3, label: 'Semana 3', range: 'Dias 15 a 21', min: 15, max: 21 },
      { id: 4, label: 'Semana 4', range: 'Dias 22 a 31', min: 22, max: 31 },
    ];

    return weeks.map(w => {
      const items = enrichedFixedExpenses.filter(f => f.due_day >= w.min && f.due_day <= w.max);
      const totalAmount = items.reduce((sum, i) => sum + Number(i.amount), 0);
      const paidAmount = items.filter(i => i.isPaid).reduce((sum, i) => sum + Number(i.amount), 0);
      const pendingAmount = Math.max(0, totalAmount - paidAmount);
      const isComplete = items.length > 0 && items.every(i => i.isPaid);

      return {
        ...w,
        items,
        totalAmount,
        paidAmount,
        pendingAmount,
        isComplete
      };
    });
  }, [enrichedFixedExpenses]);

  // Cálculos de Dívidas
  const totalDebtsAmount = debts.reduce((sum, d) => sum + Number(d.total_amount), 0);
  const totalMonthlyDebtsInstallment = debts.reduce((sum, d) => sum + Number(d.monthly_installment), 0);
  const totalRemainingDebt = debts.reduce((sum, d) => {
    const remainingInstallments = Math.max(0, d.total_installments - d.paid_installments);
    return sum + (remainingInstallments * Number(d.monthly_installment));
  }, 0);

  // Abertura do Modal de Baixa Rápida / Pagar
  const handleOpenQuickPay = (item: any) => {
    setQuickPayItem(item);
    setQuickPayAmount(formatNumberToCurrencyInput(item.amount));
    setQuickPayAccountId(item.account_id || checkingAccounts[0]?.id || '');
    setQuickPayDate(format(new Date(), 'yyyy-MM-dd'));
  };

  // Confirmação de Baixa Rápida
  const handleConfirmQuickPay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickPayItem) return;

    const val = parseCurrency(quickPayAmount);
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor válido.');
      return;
    }

    try {
      setIsSubmittingQuickPay(true);
      await addTransactionMutation.mutateAsync({
        tx: {
          date: quickPayDate,
          description: `Gasto Fixo: ${quickPayItem.name}`,
          amount: val,
          type: 'expense',
          status: 'completed',
          category_name: quickPayItem.category_name || 'Moradia & Contas',
          account_id: quickPayAccountId || undefined,
          imported_via_csv: false,
          is_recurring: true
        },
        generateInstallments: false
      });

      toast.success(`Pagamento de "${quickPayItem.name}" registrado com sucesso no mês!`);
      setQuickPayItem(null);
    } catch {
      toast.error('Erro ao registrar pagamento.');
    } finally {
      setIsSubmittingQuickPay(false);
    }
  };

  const handleAddFixed = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseCurrency(fixedAmount);
    if (!fixedName.trim() || isNaN(val) || val <= 0) {
      toast.error('Preencha os campos obrigatórios.');
      return;
    }

    const catObj = categories.find(c => c.id === fixedCategoryId);

    try {
      await addFixedMutation.mutateAsync({
        name: fixedName.trim(),
        amount: val,
        due_day: Number(fixedDueDay),
        category_id: fixedCategoryId || undefined,
        category_name: catObj ? catObj.name : 'Moradia & Contas',
        account_id: fixedAccountId || undefined,
        is_active: true
      });
      toast.success('Gasto fixo cadastrado com sucesso!');
      setIsFixedModalOpen(false);
      setFixedName('');
      setFixedAmount('');
    } catch {
      toast.error('Erro ao cadastrar gasto fixo.');
    }
  };

  const handleAddDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    const total = parseCurrency(debtTotal);
    const monthly = parseCurrency(debtMonthly);

    if (!debtTitle.trim() || isNaN(total) || total <= 0 || isNaN(monthly) || monthly <= 0) {
      toast.error('Preencha os valores da dívida corretamente.');
      return;
    }

    try {
      await addDebtMutation.mutateAsync({
        title: debtTitle.trim(),
        creditor: debtCreditor.trim() || 'Instituição Financeira',
        total_amount: total,
        monthly_installment: monthly,
        total_installments: Number(debtTotalInstallments),
        paid_installments: Number(debtPaidInstallments),
        due_day: Number(debtDueDay),
      });
      toast.success('Dívida cadastrada com sucesso!');
      setIsDebtModalOpen(false);
      setDebtTitle('');
      setDebtCreditor('');
      setDebtTotal('');
      setDebtMonthly('');
    } catch {
      toast.error('Erro ao cadastrar dívida.');
    }
  };

  const handleAmortizeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!amortizeModalDebt) return;
    const val = parseCurrency(amortizeAmount);
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor válido de amortização.');
      return;
    }

    try {
      await amortizeDebtMutation.mutateAsync({
        debtId: amortizeModalDebt.id,
        amount: val,
        accountId: amortizeAccountId || undefined
      });
      toast.success('Parcela registrada com sucesso!');
      setAmortizeModalDebt(null);
      setAmortizeAmount('');
    } catch {
      toast.error('Erro ao amortizar dívida.');
    }
  };

  const handleDeleteFixed = async (item: any) => {
    try {
      await deleteFixedMutation.mutateAsync(item.id);
      toast.success(`Gasto fixo "${item.name}" excluído.`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              const { id: _, created_at: __, ...rest } = item;
              await addFixedMutation.mutateAsync(rest);
              toast.success('Gasto fixo restaurado com sucesso!');
            } catch {
              toast.error('Erro ao restaurar gasto fixo.');
            }
          },
        },
      });
    } catch {
      toast.error('Erro ao excluir gasto fixo.');
    }
  };

  const handleDeleteDebt = async (debt: any) => {
    try {
      await deleteDebtMutation.mutateAsync(debt.id);
      toast.success(`Dívida "${debt.title}" excluída.`, {
        action: {
          label: 'Desfazer',
          onClick: async () => {
            try {
              const { id: _, created_at: __, ...rest } = debt;
              await addDebtMutation.mutateAsync(rest);
              toast.success('Dívida restaurada com sucesso!');
            } catch {
              toast.error('Erro ao restaurar dívida.');
            }
          },
        },
      });
    } catch {
      toast.error('Erro ao excluir dívida.');
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

        <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full pb-28 md:pb-12">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Repeat className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Mensalidades, Contas & Organização Mensal
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Acompanhe o cronograma semanal de vencimentos, marque pagamentos do mês e controle suas dívidas.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              {activeTab === 'fixed' ? (
                <button
                  onClick={() => setIsFixedModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Mensalidade
                </button>
              ) : (
                <button
                  onClick={() => setIsDebtModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                >
                  <Plus className="w-4 h-4" />
                  Nova Dívida / Financiamento
                </button>
              )}
            </div>
          </div>

          {/* Segmented Tabs Principais (Mensalidades vs Dívidas) */}
          <div className="flex items-center p-1 bg-secondary/50 rounded-2xl border border-border/70 max-w-md">
            <button
              onClick={() => setActiveTab('fixed')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                activeTab === 'fixed'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Repeat className="w-3.5 h-3.5" />
              Mensalidades & Contas ({fixedExpenses.length})
            </button>
            <button
              onClick={() => setActiveTab('debts')}
              className={`flex-1 py-2 text-xs font-semibold rounded-xl flex items-center justify-center gap-2 transition-all ${
                activeTab === 'debts'
                  ? 'bg-card text-foreground shadow-xs border border-border/60'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <CreditCard className="w-3.5 h-3.5" />
              Dívidas & Financiamentos ({debts.length})
            </button>
          </div>

          {/* =========================================================
              ABA 1: MENSALIDADES & ORGANIZAÇÃO MENSAL
          ========================================================= */}
          {activeTab === 'fixed' && (
            <div className="space-y-6">
              {/* KPIs de Mensalidades do Mês */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Total Previsto */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Total Previsto no Mês</span>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Repeat className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatMoney(totalMonthlyFixed)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {fixedExpenses.length} mensalidades cadastradas
                  </p>
                </div>

                {/* 2. Já Pago no Mês */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Já Pago no Mês</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
                    {formatMoney(totalPaidThisMonth)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    {paidCount} de {fixedExpenses.length} quitadas ({liquidationPercentage.toFixed(0)}%)
                  </p>
                </div>

                {/* 3. Restante a Pagar */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Restante a Pagar</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Clock className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-amber-400 tabular-nums">
                    {formatMoney(totalPendingThisMonth)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {fixedExpenses.length - paidCount} pendentes no período
                  </p>
                </div>

                {/* 4. Barra de Liquidação */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col justify-between">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-muted-foreground">Taxa de Liquidação</span>
                    <span className="font-bold text-emerald-400 tabular-nums">
                      {liquidationPercentage.toFixed(0)}%
                    </span>
                  </div>
                  <div className="my-2 w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, liquidationPercentage)}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {liquidationPercentage === 100 
                      ? '✓ Todas as contas do mês quitadas!' 
                      : 'Controle seu saldo para os próximos vencimentos.'}
                  </p>
                </div>
              </div>

              {/* Barra de Controles: Alternador de Visualização & Filtros */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                {/* Visualização: Cards vs Cronograma Semanal */}
                <div className="flex items-center p-1 bg-secondary/40 rounded-xl border border-border/60">
                  <button
                    onClick={() => setMonthlyView('cards')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      monthlyView === 'cards'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Visão em Cartões
                  </button>
                  <button
                    onClick={() => setMonthlyView('schedule')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                      monthlyView === 'schedule'
                        ? 'bg-card text-foreground shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <Calendar className="w-3.5 h-3.5" />
                    Cronograma Semanal (Organização)
                  </button>
                </div>

                {/* Filtro de Status */}
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground mr-1 hidden sm:inline">Filtrar:</span>
                  <button
                    onClick={() => setStatusFilter('all')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === 'all'
                        ? 'bg-primary text-primary-foreground font-semibold'
                        : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Todas ({enrichedFixedExpenses.length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('pending')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === 'pending'
                        ? 'bg-amber-500 text-black font-semibold'
                        : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    A Pagar ({enrichedFixedExpenses.filter(e => !e.isPaid).length})
                  </button>
                  <button
                    onClick={() => setStatusFilter('paid')}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
                      statusFilter === 'paid'
                        ? 'bg-emerald-600 text-white font-semibold'
                        : 'bg-secondary/40 text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Pagas ({enrichedFixedExpenses.filter(e => e.isPaid).length})
                  </button>
                </div>
              </div>

              {/* SUBVISÃO 1: CRONOGRAMA SEMANAL (ORGANIZAÇÃO MENSAL) */}
              {monthlyView === 'schedule' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {weeklySchedule.map((week) => (
                      <div
                        key={week.id}
                        className={`p-5 rounded-2xl bg-card border shadow-sm flex flex-col justify-between transition-all ${
                          week.isComplete 
                            ? 'border-emerald-500/40 bg-emerald-500/5' 
                            : 'border-border/80'
                        }`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between pb-2 border-b border-border/60">
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{week.label}</h4>
                              <span className="text-[10px] text-muted-foreground">{week.range}</span>
                            </div>
                            <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border ${
                              week.isComplete
                                ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                                : week.items.length > 0
                                ? 'bg-secondary text-muted-foreground border-border'
                                : 'bg-transparent text-muted-foreground border-dashed'
                            }`}>
                              {week.isComplete ? '✓ Liquidado' : `${week.items.length} contas`}
                            </span>
                          </div>

                          <div className="flex items-baseline justify-between pt-1">
                            <span className="text-xs text-muted-foreground">Total da Semana:</span>
                            <span className="font-bold text-sm text-foreground tabular-nums">
                              {formatMoney(week.totalAmount)}
                            </span>
                          </div>

                          {/* Lista das contas desta semana */}
                          <div className="space-y-2 pt-1 max-h-56 overflow-y-auto pr-1">
                            {week.items.length === 0 ? (
                              <p className="text-[11px] text-muted-foreground italic py-3 text-center">
                                Nenhum vencimento nesta semana.
                              </p>
                            ) : (
                              week.items.map((item) => (
                                <div
                                  key={item.id}
                                  className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 text-xs transition-colors ${
                                    item.isPaid
                                      ? 'bg-emerald-500/5 border-emerald-500/20'
                                      : 'bg-secondary/30 border-border/60'
                                  }`}
                                >
                                  <div className="min-w-0 pr-1">
                                    <div className="flex items-center gap-1.5">
                                      {item.isPaid ? (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                      ) : (
                                        <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                      )}
                                      <span className="font-semibold text-foreground truncate block">
                                        {item.name}
                                      </span>
                                    </div>
                                    <span className="text-[10px] text-muted-foreground block mt-0.5">
                                      Dia {item.due_day} • {formatMoney(Number(item.amount))}
                                    </span>
                                  </div>

                                  {!item.isPaid ? (
                                    <button
                                      onClick={() => handleOpenQuickPay(item)}
                                      className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold shrink-0 transition-all active:scale-95 shadow-xs"
                                    >
                                      Pagar
                                    </button>
                                  ) : (
                                    <span className="text-[10px] text-emerald-400 font-semibold shrink-0">
                                      Pago
                                    </span>
                                  )}
                                </div>
                              ))
                            )}
                          </div>
                        </div>

                        <div className="pt-3 mt-3 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground tabular-nums">
                          <span>Pago: {formatMoney(week.paidAmount)}</span>
                          <span>Resta: {formatMoney(week.pendingAmount)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SUBVISÃO 2: CARDS DE MENSALIDADES */}
              {monthlyView === 'cards' && (
                <div className="space-y-4">
                  {filteredFixedExpenses.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl bg-card border border-border/70 flex flex-col items-center justify-center">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-3">
                        <Repeat className="w-6 h-6" />
                      </div>
                      <h4 className="text-sm font-semibold text-foreground">
                        {statusFilter === 'all' 
                          ? 'Nenhuma mensalidade cadastrada' 
                          : statusFilter === 'pending'
                          ? 'Nenhuma mensalidade pendente neste mês!'
                          : 'Nenhuma mensalidade paga identificada ainda.'}
                      </h4>
                      <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                        {statusFilter === 'all'
                          ? 'Cadastre despesas mensais essenciais como aluguel, condomínio, internet, energia e assinaturas.'
                          : 'Alterne os filtros acima para ver todos os seus compromissos.'}
                      </p>
                      {statusFilter === 'all' && (
                        <button
                          onClick={() => setIsFixedModalOpen(true)}
                          className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                        >
                          + Adicionar Mensalidade
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {filteredFixedExpenses.map((item) => (
                        <div
                          key={item.id}
                          className={`p-5 rounded-2xl bg-card border shadow-sm hover:border-primary/40 transition-all flex flex-col justify-between ${
                            item.isPaid ? 'border-emerald-500/30' : 'border-border/80'
                          }`}
                        >
                          <div>
                            <div className="flex items-start justify-between">
                              <div>
                                <h4 className="font-bold text-sm text-foreground">{item.name}</h4>
                                <span className="text-[11px] text-muted-foreground">{item.category_name}</span>
                              </div>

                              {/* Badge de Status Inteligente */}
                              {item.isPaid ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                  <Check className="w-3 h-3" />
                                  Pago no Mês
                                </span>
                              ) : item.isDueToday ? (
                                <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse">
                                  Vence hoje!
                                </span>
                              ) : item.isOverdue ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-500/15 text-rose-400 border border-rose-500/30">
                                  Atrasado ({Math.abs(item.diffDays)}d)
                                </span>
                              ) : item.isDueSoon ? (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  Vence em {item.diffDays}d
                                </span>
                              ) : (
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                                  Dia {item.due_day}
                                </span>
                              )}
                            </div>

                            <div className="mt-4">
                              <span className="text-xs text-muted-foreground">Valor Mensal:</span>
                              <div className="text-xl font-extrabold text-foreground tabular-nums">
                                {formatMoney(Number(item.amount))}
                              </div>
                            </div>
                          </div>

                          <div className="mt-5 pt-3 border-t border-border/70 flex items-center justify-between">
                            {!item.isPaid ? (
                              <button
                                onClick={() => handleOpenQuickPay(item)}
                                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all active:scale-95 shadow-xs"
                                title="Dar baixa nesta mensalidade"
                              >
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Pagar Mensalidade
                              </button>
                            ) : (
                              <span className="text-xs text-emerald-400 font-semibold flex items-center gap-1">
                                <CheckCheck className="w-3.5 h-3.5" />
                                Liquidado
                              </span>
                            )}

                            <button
                              onClick={() => handleDeleteFixed(item)}
                              className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                              title="Excluir mensalidade"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* =========================================================
              ABA 2: DÍVIDAS & FINANCIAMENTOS
          ========================================================= */}
          {activeTab === 'debts' && (
            <div className="space-y-6">
              {/* KPIs de Dívidas */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Parcelas de Dívidas Ativas</span>
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <CreditCard className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-rose-400 tabular-nums">
                    {formatMoney(totalMonthlyDebtsInstallment)}
                    <span className="text-xs text-muted-foreground font-normal ml-1">/mês</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {debts.length} dívida{debts.length === 1 ? '' : 's'} em andamento
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Saldo Devedor Restante</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <TrendingDown className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatMoney(totalRemainingDebt)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Montante total para quitar todos os contratos
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-muted-foreground">Total Contratado Original</span>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Building2 className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
                    {formatMoney(totalDebtsAmount)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Valor nominal inicial somado
                  </p>
                </div>
              </div>

              {/* Lista de Dívidas */}
              {debts.length === 0 ? (
                <div className="p-12 text-center rounded-2xl bg-card border border-border/70 flex flex-col items-center justify-center">
                  <div className="w-12 h-12 rounded-2xl bg-rose-500/10 text-rose-400 flex items-center justify-center mb-3">
                    <CreditCard className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-foreground">Nenhuma dívida ou financiamento registrado</h4>
                  <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                    Controle empréstimos, financiamentos e dívidas para acompanhar o progresso de quitação.
                  </p>
                  <button
                    onClick={() => setIsDebtModalOpen(true)}
                    className="mt-4 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                  >
                    + Adicionar Dívida / Financiamento
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {debts.map((debt) => {
                    const progress = debt.total_installments > 0 
                      ? (debt.paid_installments / debt.total_installments) * 100 
                      : 0;
                    const remainingInstallments = Math.max(0, debt.total_installments - debt.paid_installments);
                    const remainingAmount = remainingInstallments * Number(debt.monthly_installment);

                    return (
                      <div
                        key={debt.id}
                        className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm hover:border-rose-500/30 transition-all flex flex-col justify-between"
                      >
                        <div>
                          <div className="flex items-start justify-between">
                            <div>
                              <h4 className="font-bold text-sm text-foreground">{debt.title}</h4>
                              <div className="flex items-center gap-1.5 text-xs text-muted-foreground mt-0.5">
                                <Building2 className="w-3 h-3" />
                                <span>{debt.creditor}</span>
                              </div>
                            </div>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-secondary text-muted-foreground border border-border">
                              Vencimento dia {debt.due_day || 10}
                            </span>
                          </div>

                          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-border/60">
                            <div>
                              <span className="text-[11px] text-muted-foreground">Parcela Mensal:</span>
                              <div className="text-base font-bold text-rose-400 tabular-nums">
                                {formatMoney(Number(debt.monthly_installment))}
                              </div>
                            </div>
                            <div>
                              <span className="text-[11px] text-muted-foreground">Saldo Restante:</span>
                              <div className="text-base font-bold text-foreground tabular-nums">
                                {formatMoney(remainingAmount)}
                              </div>
                            </div>
                          </div>

                          {/* Barra de Progresso */}
                          <div className="mt-4 space-y-1.5">
                            <div className="flex items-center justify-between text-xs font-semibold">
                              <span className="text-muted-foreground">
                                Parcelas: {debt.paid_installments} de {debt.total_installments}
                              </span>
                              <span className="text-emerald-400 tabular-nums">
                                {progress.toFixed(0)}% quitado
                              </span>
                            </div>
                            <div className="w-full h-2.5 rounded-full bg-secondary overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="mt-5 pt-3 border-t border-border/70 flex items-center justify-between">
                          <button
                            onClick={() => {
                              setAmortizeModalDebt(debt);
                              setAmortizeAmount(formatNumberToCurrencyInput(debt.monthly_installment));
                            }}
                            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-xs transition-all active:scale-95"
                          >
                            <DollarSign className="w-3.5 h-3.5" />
                            Pagar Parcela
                          </button>
                          <button
                            onClick={() => handleDeleteDebt(debt)}
                            className="p-1.5 text-muted-foreground hover:text-destructive rounded-lg hover:bg-destructive/10 transition-colors"
                            title="Excluir dívida"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      <MobileBottomNav />

      {/* Modal: Pagar Mensalidade / Dar Baixa Rápida */}
      {quickPayItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="bg-card border border-border rounded-2xl w-full max-w-md shadow-2xl p-6 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">Dar Baixa na Mensalidade</h3>
                  <p className="text-[10px] text-muted-foreground">{quickPayItem.name}</p>
                </div>
              </div>
              <button onClick={() => setQuickPayItem(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmQuickPay} className="space-y-3.5">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Valor do Pagamento (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={quickPayAmount}
                    onChange={(e) => setQuickPayAmount((prev) => maskCurrency(e.target.value, prev))}
                    placeholder="0,00"
                    className="w-full bg-secondary/40 text-foreground text-sm font-bold pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-mono tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Data do Pagamento</label>
                <input
                  type="date"
                  value={quickPayDate}
                  onChange={(e) => setQuickPayDate(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Debitar de qual Conta?</label>
                <select
                  value={quickPayAccountId}
                  onChange={(e) => setQuickPayAccountId(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Nenhuma conta específica</option>
                  {checkingAccounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Saldo: {formatMoney(Number(acc.balance))})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setQuickPayItem(null)}
                  className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingQuickPay}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingQuickPay ? 'Gravando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Mensalidade / Gasto Fixo */}
      {isFixedModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <h3 className="font-bold text-sm text-foreground">Nova Mensalidade ou Conta Fixa</h3>
              <button onClick={() => setIsFixedModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddFixed} className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Nome do Compromisso *</label>
                <input
                  type="text"
                  placeholder="Ex: Aluguel, Internet Fibra, Energia, Netflix, Academia..."
                  value={fixedName}
                  onChange={(e) => setFixedName(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Valor Mensal (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={fixedAmount}
                      onChange={(e) => setFixedAmount((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-bold font-mono tabular-nums"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Dia do Vencimento *</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={fixedDueDay}
                    onChange={(e) => setFixedDueDay(parseInt(e.target.value) || 1)}
                    className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Categoria</label>
                <select
                  value={fixedCategoryId}
                  onChange={(e) => setFixedCategoryId(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Selecione uma categoria...</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Conta de Pagamento Padrão</label>
                <select
                  value={fixedAccountId}
                  onChange={(e) => setFixedAccountId(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Qualquer Conta / Cartão</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFixedModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addFixedMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                >
                  {addFixedMutation.isPending ? 'Salvando...' : 'Cadastrar Mensalidade'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Nova Dívida */}
      {isDebtModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <h3 className="font-bold text-sm text-foreground">Nova Dívida ou Financiamento</h3>
              <button onClick={() => setIsDebtModalOpen(false)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddDebt} className="space-y-3.5 mt-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Título do Contrato / Dívida *</label>
                <input
                  type="text"
                  placeholder="Ex: Financiamento Imobiliário, Empréstimo Pessoal..."
                  value={debtTitle}
                  onChange={(e) => setDebtTitle(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Credor / Banco</label>
                <input
                  type="text"
                  placeholder="Ex: Caixa, Santander, Banco do Brasil..."
                  value={debtCreditor}
                  onChange={(e) => setDebtCreditor(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Valor Total (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={debtTotal}
                      onChange={(e) => setDebtTotal((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-bold font-mono tabular-nums"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Parcela Mensal (R$) *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      placeholder="0,00"
                      value={debtMonthly}
                      onChange={(e) => setDebtMonthly((prev) => maskCurrency(e.target.value, prev))}
                      className="w-full bg-secondary/40 text-foreground text-xs pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-bold text-rose-400 font-mono tabular-nums"
                      required
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Total Parc. *</label>
                  <input
                    type="number"
                    min="1"
                    value={debtTotalInstallments}
                    onChange={(e) => setDebtTotalInstallments(parseInt(e.target.value) || 1)}
                    className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                    required
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Pagas</label>
                  <input
                    type="number"
                    min="0"
                    value={debtPaidInstallments}
                    onChange={(e) => setDebtPaidInstallments(parseInt(e.target.value) || 0)}
                    className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">Dia Venc.</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={debtDueDay}
                    onChange={(e) => setDebtDueDay(parseInt(e.target.value) || 10)}
                    className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsDebtModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addDebtMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm transition-all"
                >
                  {addDebtMutation.isPending ? 'Salvando...' : 'Cadastrar Dívida'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Amortizar / Pagar Parcela da Dívida */}
      {amortizeModalDebt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-card border border-border/80 rounded-2xl w-full max-w-sm shadow-2xl p-6">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <h3 className="font-bold text-sm text-foreground">Pagar Parcela / Amortizar</h3>
              <button onClick={() => setAmortizeModalDebt(null)} className="text-muted-foreground hover:text-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-3">
              <p className="text-xs text-muted-foreground">
                Contrato: <strong className="text-foreground">{amortizeModalDebt.title}</strong>
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Progresso: {amortizeModalDebt.paid_installments} de {amortizeModalDebt.total_installments} parcelas
              </p>
            </div>

            <form onSubmit={handleAmortizeSubmit} className="space-y-3 mt-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Valor da Parcela (R$)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={amortizeAmount}
                    onChange={(e) => setAmortizeAmount((prev) => maskCurrency(e.target.value, prev))}
                    placeholder="0,00"
                    className="w-full bg-secondary/40 text-foreground text-sm font-bold pl-9 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary font-mono tabular-nums"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">Debitar de qual Conta?</label>
                <select
                  value={amortizeAccountId}
                  onChange={(e) => setAmortizeAccountId(e.target.value)}
                  className="w-full bg-secondary/40 text-foreground text-xs p-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary cursor-pointer"
                >
                  <option value="">Nenhuma conta (não registrar saída)</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.name} ({formatMoney(Number(a.balance))})</option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAmortizeModalDebt(null)}
                  className="px-4 py-2 rounded-xl bg-secondary text-foreground text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={amortizeDebtMutation.isPending}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all"
                >
                  {amortizeDebtMutation.isPending ? 'Gravando...' : 'Confirmar Baixa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
