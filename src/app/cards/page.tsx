'use client';

import React, { useState, useMemo } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { 
  useAccounts, 
  useTransactions, 
  useProfile,
  useAddTransaction, 
  useUpdateAccount,
  useAddAccount,
  useDeleteAccount
} from '@/hooks/use-financial';
import { usePrivacy } from '@/components/providers/privacy-provider';
import { usePeriod } from '@/components/providers/period-provider';
import { AccountAndCard, Transaction } from '@/lib/supabase/types';
import { AccountModal } from '@/components/accounts/account-modal';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';
import { 
  CreditCard, 
  Plus, 
  CheckCircle2, 
  AlertTriangle, 
  Calendar, 
  ArrowRight, 
  TrendingUp, 
  Wallet, 
  ChevronRight, 
  Clock, 
  Sparkles, 
  DollarSign, 
  Layers, 
  ShieldCheck,
  Zap, 
  Flame, 
  Edit2, 
  Trash2,
  Check,
  X,
  ArrowUpRight,
  ArrowDownRight,
  Info
} from 'lucide-react';
import { format, addMonths, parseISO, getDate, getDaysInMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toast } from 'sonner';

export default function CardsPage() {
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: profile } = useProfile();
  const { formatMoney } = usePrivacy();

  const addTransactionMutation = useAddTransaction();
  const updateAccountMutation = useUpdateAccount();
  const addAccountMutation = useAddAccount();
  const deleteAccountMutation = useDeleteAccount();

  // Filtrar apenas contas que são Cartões de Crédito
  const creditCards = useMemo(() => {
    return accounts.filter(a => a.type === 'credit_card' || a.name.toLowerCase().includes('cartão'));
  }, [accounts]);

  // Contas Correntes disponíveis para pagamento de fatura
  const checkingAccounts = useMemo(() => {
    return accounts.filter(a => a.type === 'checking' || a.type === 'cash');
  }, [accounts]);

  // Cartão selecionado
  const [selectedCardId, setSelectedCardId] = useState<string>(() => {
    return creditCards[0]?.id || '';
  });

  // Manter sincronizado se a lista de cartões mudar
  const currentCard = useMemo(() => {
    return creditCards.find(c => c.id === selectedCardId) || creditCards[0] || null;
  }, [creditCards, selectedCardId]);

  // Mês de referência global automático
  const { selectedMonth, setSelectedMonth } = usePeriod();

  // Modais
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<AccountAndCard | null>(null);
  const [isPayInvoiceModalOpen, setIsPayInvoiceModalOpen] = useState(false);

  // Form Pagamento de Fatura
  const [payAmount, setPayAmount] = useState('');
  const [sourceAccountId, setSourceAccountId] = useState('');
  const [isSubmittingPay, setIsSubmittingPay] = useState(false);

  // Transações do cartão selecionado
  const cardTransactions = useMemo(() => {
    if (!currentCard) return [];
    return transactions.filter(t => t.account_id === currentCard.id && t.type === 'expense');
  }, [transactions, currentCard]);

  // Transações do mês / ciclo selecionado
  const currentInvoiceTransactions = useMemo(() => {
    return cardTransactions.filter(t => t.date.startsWith(selectedMonth));
  }, [cardTransactions, selectedMonth]);

  // Valor da Fatura Aberta no mês
  const currentInvoiceTotal = useMemo(() => {
    return currentInvoiceTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
  }, [currentInvoiceTransactions]);

  // Compras parceladas ativas vinculadas a este cartão
  const activeInstallments = useMemo(() => {
    if (!currentCard) return [];
    // Agrupar transações parceladas
    const map = new Map<string, {
      description: string;
      current: number;
      total: number;
      amount: number;
      remainingInstallments: number;
      remainingAmount: number;
      date: string;
      category?: string;
    }>();

    cardTransactions
      .filter(t => t.installment_total && t.installment_total > 1)
      .forEach(t => {
        const key = t.installment_group_id || t.description.replace(/\s*\(\d+\/\d+\)/, '');
        const currentInst = t.installment_current || 1;
        const totalInst = t.installment_total || 1;
        const remainingInst = Math.max(0, totalInst - currentInst);

        if (!map.has(key) || currentInst > (map.get(key)?.current || 0)) {
          map.set(key, {
            description: key,
            current: currentInst,
            total: totalInst,
            amount: Number(t.amount),
            remainingInstallments: remainingInst,
            remainingAmount: remainingInst * Number(t.amount),
            date: t.date,
            category: t.category_name
          });
        }
      });

    return Array.from(map.values());
  }, [cardTransactions, currentCard]);

  // Cálculos de Limite do Cartão Selecionado
  const creditLimit = Number(currentCard?.credit_limit || 0);
  const availableLimit = Math.max(0, creditLimit - currentInvoiceTotal);
  const limitUsagePercentage = creditLimit > 0 ? (currentInvoiceTotal / creditLimit) * 100 : 0;

  // Informações de Ciclo de Fatura
  const closingDay = currentCard?.closing_day || 25;
  const dueDay = currentCard?.due_day || 3;
  // Melhor dia para compras: dia do fechamento + 1
  const bestPurchaseDay = closingDay >= 28 ? 1 : closingDay + 1;

  // Dias até o vencimento da fatura
  const now = new Date();
  const currentDay = now.getDate();
  const daysUntilDue = dueDay >= currentDay ? dueDay - currentDay : (getDaysInMonth(now) - currentDay) + dueDay;

  // Projeção das próximas 4 faturas
  const projectedInvoices = useMemo(() => {
    const list: { monthKey: string; monthLabel: string; amount: number; isCurrent: boolean }[] = [];
    const baseDate = parseISO(`${selectedMonth}-01`);

    for (let i = 0; i < 4; i++) {
      const targetMonthDate = addMonths(baseDate, i);
      const mKey = format(targetMonthDate, 'yyyy-MM');
      const mLabel = format(targetMonthDate, 'MMMM/yy', { locale: ptBR });

      // Soma de gastos conhecidos naquele mês
      const monthExpenses = cardTransactions
        .filter(t => t.date.startsWith(mKey))
        .reduce((sum, t) => sum + Number(t.amount), 0);

      list.push({
        monthKey: mKey,
        monthLabel: mLabel.charAt(0).toUpperCase() + mLabel.slice(1),
        amount: monthExpenses,
        isCurrent: i === 0
      });
    }

    return list;
  }, [selectedMonth, cardTransactions]);

  // Abertura do Modal de Pagar Fatura
  const handleOpenPayInvoice = () => {
    setPayAmount(formatNumberToCurrencyInput(currentInvoiceTotal));
    if (checkingAccounts.length > 0) {
      setSourceAccountId(checkingAccounts[0].id);
    }
    setIsPayInvoiceModalOpen(true);
  };

  // Submissão do Pagamento de Fatura
  const handleConfirmPayInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = parseCurrency(payAmount);
    if (isNaN(val) || val <= 0) {
      toast.error('Informe um valor válido para o pagamento da fatura.');
      return;
    }

    if (!sourceAccountId) {
      toast.error('Selecione a conta corrente de onde o valor será debitado.');
      return;
    }

    const sourceAcc = accounts.find(a => a.id === sourceAccountId);

    try {
      setIsSubmittingPay(true);
      const today = format(new Date(), 'yyyy-MM-dd');

      // 1. Debita da conta bancária de origem
      await addTransactionMutation.mutateAsync({
        tx: {
          date: today,
          description: `Pagamento de Fatura - ${currentCard?.name || 'Cartão'}`,
          amount: val,
          type: 'expense',
          status: 'completed',
          category_name: 'Fatura de Cartão',
          account_id: sourceAccountId,
          imported_via_csv: false,
          is_recurring: false
        },
        generateInstallments: false
      });

      // 2. Registra o crédito correspondente ou baixa no cartão
      if (currentCard) {
        await updateAccountMutation.mutateAsync({
          ...currentCard,
          balance: Number(currentCard.balance) + val
        });
      }

      toast.success(`Fatura de ${formatMoney(val)} paga com sucesso via ${sourceAcc?.name || 'Conta'}!`);
      setIsPayInvoiceModalOpen(false);
    } catch {
      toast.error('Erro ao processar pagamento da fatura.');
    } finally {
      setIsSubmittingPay(false);
    }
  };

  // Salvar novo cartão ou edição
  const handleSaveAccount = async (accData: Omit<AccountAndCard, 'id'>, id?: string) => {
    if (id) {
      await updateAccountMutation.mutateAsync({ ...accData, id } as AccountAndCard);
    } else {
      const created = await addAccountMutation.mutateAsync(accData);
      setSelectedCardId(created.id);
    }
  };

  // Excluir cartão
  const handleDeleteCard = async (cardId: string) => {
    if (!confirm('Deseja realmente remover este cartão? As transações vinculadas serão mantidas no extrato.')) return;
    try {
      await deleteAccountMutation.mutateAsync(cardId);
      toast.success('Cartão excluído com sucesso.');
      const remaining = creditCards.filter(c => c.id !== cardId);
      setSelectedCardId(remaining[0]?.id || '');
    } catch {
      toast.error('Erro ao remover cartão.');
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
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center border border-violet-500/20">
                  <CreditCard className="w-5 h-5" />
                </div>
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                  Cartões de Crédito & Faturas
                </h1>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Monitore limites disponíveis, ciclos de fechamento, faturas abertas e compras parceladas.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setAccountToEdit(null);
                  setIsAccountModalOpen(true);
                }}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all"
              >
                <Plus className="w-4 h-4" />
                Novo Cartão
              </button>
            </div>
          </div>

          {/* Seção 1: Deck de Cartões Realistas (Carousel/Selector) */}
          {creditCards.length === 0 ? (
            <div className="p-10 rounded-2xl bg-card border border-border/80 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <CreditCard className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-foreground">Nenhum Cartão de Crédito Cadastrado</h3>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                Cadastre seus cartões Nubank, Inter, Itaú, XP ou qualquer outra instituição para acompanhar o consumo do limite e faturas mensais.
              </p>
              <button
                onClick={() => {
                  setAccountToEdit(null);
                  setIsAccountModalOpen(true);
                }}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-semibold shadow-sm"
              >
                + Adicionar Primeiro Cartão
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  Seus Cartões ({creditCards.length})
                </span>
                <span className="text-[11px] text-muted-foreground">
                  Clique para selecionar o cartão ativo
                </span>
              </div>

              {/* Grid / Deck de Cartões Digitais (Carrossel Horizontal no mobile, Grid no Desktop) */}
              <div className="flex md:grid md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto md:overflow-x-visible snap-x snap-mandatory pb-3 -mx-4 px-4 sm:mx-0 sm:px-0 scrollbar-none">
                {creditCards.map((card) => {
                  const isSelected = card.id === (currentCard?.id || '');
                  const cardBgColor = card.color || '#820AD1';

                  return (
                    <div
                      key={card.id}
                      onClick={() => setSelectedCardId(card.id)}
                      className={`relative p-5 rounded-2xl cursor-pointer transition-all duration-300 overflow-hidden flex flex-col justify-between h-48 select-none min-w-[280px] xs:min-w-[320px] md:min-w-0 snap-center shrink-0 md:shrink ${
                        isSelected 
                          ? 'ring-2 ring-primary ring-offset-2 ring-offset-background scale-[1.01] shadow-xl' 
                          : 'opacity-85 hover:opacity-100 hover:scale-[1.005]'
                      }`}
                      style={{
                        background: `linear-gradient(135deg, ${cardBgColor}ee 0%, #0d0f17 100%)`,
                        border: isSelected ? '1px solid rgba(255,255,255,0.3)' : '1px solid rgba(255,255,255,0.1)'
                      }}
                    >
                      {/* Efeito Glow e Textura */}
                      <div className="absolute top-0 right-0 w-36 h-36 bg-white/5 rounded-full blur-2xl pointer-events-none" />

                      {/* Topo do Cartão: Instituição e Chip */}
                      <div className="flex items-center justify-between z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-extrabold tracking-wide text-white drop-shadow-sm">
                            {card.institution || card.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Ícone Contactless */}
                          <div className="flex gap-0.5 items-center opacity-80" title="Pagamento por aproximação">
                            <span className="w-1 h-3 rounded-full bg-white/70" />
                            <span className="w-1 h-4 rounded-full bg-white/70" />
                            <span className="w-1 h-5 rounded-full bg-white/70" />
                          </div>
                          {/* Bandeira estilizada Mastercard / Visa */}
                          <div className="flex -space-x-2 opacity-90">
                            <div className="w-5 h-5 rounded-full bg-rose-500/90" />
                            <div className="w-5 h-5 rounded-full bg-amber-400/90" />
                          </div>
                        </div>
                      </div>

                      {/* Meio do Cartão: Chip Metálico */}
                      <div className="z-10 my-auto flex items-center justify-between">
                        <div className="w-10 h-7 rounded-md bg-gradient-to-tr from-amber-300 via-amber-200 to-amber-400 border border-amber-500/50 shadow-inner flex items-center justify-center">
                          <div className="w-full h-px bg-amber-600/40" />
                        </div>
                        <span className="text-xs font-mono tracking-widest text-white/90 drop-shadow-xs">
                          •••• •••• •••• {card.id.substring(card.id.length - 4)}
                        </span>
                      </div>

                      {/* Base do Cartão: Nome do Titular e Datas */}
                      <div className="flex items-end justify-between z-10 text-white/90">
                        <div>
                          <span className="text-[9px] uppercase tracking-wider text-white/70 block">Titular</span>
                          <span className="text-xs font-bold tracking-wide truncate max-w-[130px] block">
                            {profile?.full_name?.toUpperCase() || card.name.toUpperCase()}
                          </span>
                        </div>

                        <div className="text-right">
                          <span className="text-[9px] uppercase tracking-wider text-white/70 block">Vencimento</span>
                          <span className="text-xs font-bold tabular-nums">
                            Dia {card.due_day || 3}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Seção 2: Painel Executivo do Cartão Selecionado */}
          {currentCard && (
            <div className="space-y-6 pt-2">
              {/* Barra de Ações Rápidas do Cartão */}
              <div className="p-4 rounded-2xl bg-card border border-border/80 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div 
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm shadow-sm"
                    style={{ backgroundColor: currentCard.color || '#820AD1' }}
                  >
                    <CreditCard className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-base text-foreground">{currentCard.name}</h3>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary font-semibold border border-border/60">
                        {currentCard.institution || 'Cartão de Crédito'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Fecha todo dia {closingDay} • Vence todo dia {dueDay}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => {
                      setAccountToEdit(currentCard);
                      setIsAccountModalOpen(true);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold flex items-center gap-1.5 border border-border/60 transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    Editar Limite/Datas
                  </button>

                  <button
                    onClick={handleOpenPayInvoice}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-sm transition-all active:scale-95"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Pagar Fatura
                  </button>

                  <button
                    onClick={() => handleDeleteCard(currentCard.id)}
                    className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title="Excluir Cartão"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Grid 4 KPIs do Cartão */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* 1. Fatura Aberta Atual */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Fatura Aberta Atual</span>
                    <div className="w-7 h-7 rounded-lg bg-rose-500/10 text-rose-400 flex items-center justify-center">
                      <Flame className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-rose-400 tabular-nums">
                    {formatMoney(currentInvoiceTotal)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    {currentInvoiceTransactions.length} compras no ciclo
                  </p>
                </div>

                {/* 2. Limite Disponível */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Limite Disponível</span>
                    <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-emerald-400 tabular-nums">
                    {formatMoney(availableLimit)}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                    De {formatMoney(creditLimit)} total
                  </p>
                </div>

                {/* 3. Melhor Dia de Compra */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Melhor Dia de Compra</span>
                    <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <Zap className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                    Dia {bestPurchaseDay}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1">
                    Até 40 dias para pagar
                  </p>
                </div>

                {/* 4. Vencimento da Fatura */}
                <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm relative overflow-hidden">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-semibold text-muted-foreground">Vencimento</span>
                    <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-400 flex items-center justify-center">
                      <Calendar className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">
                    Dia {dueDay}
                  </div>
                  <p className="text-[11px] font-semibold text-amber-400 mt-1">
                    {daysUntilDue === 0 ? 'Vence hoje!' : `Faltam ${daysUntilDue} dias`}
                  </p>
                </div>
              </div>

              {/* Barra Visual de Consumo de Limite */}
              <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-foreground">
                    Uso do Limite de Crédito
                  </span>
                  <span className={`font-bold tabular-nums ${
                    limitUsagePercentage >= 85 ? 'text-rose-400' : limitUsagePercentage >= 60 ? 'text-amber-400' : 'text-emerald-400'
                  }`}>
                    {limitUsagePercentage.toFixed(1)}% utilizado
                  </span>
                </div>

                <div className="w-full h-3 rounded-full bg-secondary overflow-hidden relative">
                  <div
                    className={`h-full rounded-full transition-all duration-700 ${
                      limitUsagePercentage >= 85 ? 'bg-rose-500' : limitUsagePercentage >= 60 ? 'bg-amber-400' : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(100, limitUsagePercentage)}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1 tabular-nums">
                  <span>Utilizado: {formatMoney(currentInvoiceTotal)}</span>
                  <span>Livre: {formatMoney(availableLimit)}</span>
                  <span>Limite Total: {formatMoney(creditLimit)}</span>
                </div>
              </div>

              {/* Grid 2 Colunas: Projeção de Faturas Futuras & Compras Parceladas */}
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Coluna 1: Projeção dos Próximos Meses (5 colunas) */}
                <div className="lg:col-span-5 space-y-4">
                  <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                          <Layers className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="font-bold text-sm text-foreground">Projeção de Faturas Futuras</h4>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Próximos 4 ciclos</span>
                    </div>

                    <div className="space-y-2.5">
                      {projectedInvoices.map((inv, idx) => (
                        <div
                          key={idx}
                          className={`p-3 rounded-xl border flex items-center justify-between transition-colors ${
                            inv.isCurrent
                              ? 'bg-primary/5 border-primary/30'
                              : 'bg-secondary/30 border-border/60'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2 h-2 rounded-full ${inv.isCurrent ? 'bg-primary' : 'bg-muted-foreground'}`} />
                            <div>
                              <span className="font-semibold text-xs text-foreground block">
                                {inv.monthLabel}
                              </span>
                              <span className="text-[10px] text-muted-foreground">
                                {inv.isCurrent ? 'Fatura Aberta (Ciclo Atual)' : 'Fatura Projetada'}
                              </span>
                            </div>
                          </div>

                          <span className="font-bold text-xs tabular-nums text-foreground">
                            {formatMoney(inv.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Coluna 2: Compras Parceladas Ativas (7 colunas) */}
                <div className="lg:col-span-7 space-y-4">
                  <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-lg bg-amber-500/10 text-amber-500 flex items-center justify-center">
                          <Clock className="w-3.5 h-3.5" />
                        </div>
                        <h4 className="font-bold text-sm text-foreground">
                          Compras Parceladas Ativas ({activeInstallments.length})
                        </h4>
                      </div>
                      <span className="text-[10px] text-muted-foreground">Parcelamentos em andamento</span>
                    </div>

                    {activeInstallments.length === 0 ? (
                      <div className="p-8 text-center rounded-xl bg-secondary/20 border border-dashed border-border/60">
                        <Clock className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                        <p className="text-xs text-muted-foreground">
                          Nenhuma compra parcelada cadastrada neste cartão.
                        </p>
                      </div>
                    ) : (
                      <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                        {activeInstallments.map((inst, idx) => (
                          <div
                            key={idx}
                            className="p-3 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between gap-3 text-xs"
                          >
                            <div className="min-w-0">
                              <span className="font-semibold text-foreground truncate block">
                                {inst.description}
                              </span>
                              <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                                <span>{inst.category || 'Geral'}</span>
                                <span>•</span>
                                <span className="text-primary font-semibold">
                                  Parcela {inst.current} de {inst.total}
                                </span>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <span className="font-bold text-foreground tabular-nums block">
                                {formatMoney(inst.amount)}/mês
                              </span>
                              <span className="text-[10px] text-muted-foreground tabular-nums">
                                Restam {inst.remainingInstallments}x ({formatMoney(inst.remainingAmount)})
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Seção 3: Compras da Fatura Atual */}
              <div className="p-5 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                      <CreditCard className="w-3.5 h-3.5" />
                    </div>
                    <h4 className="font-bold text-sm text-foreground">
                      Compras na Fatura de {format(parseISO(`${selectedMonth}-01`), 'MMMM/yyyy', { locale: ptBR })}
                    </h4>
                  </div>
                  <span className="text-xs font-bold text-foreground tabular-nums">
                    Total: {formatMoney(currentInvoiceTotal)}
                  </span>
                </div>

                {currentInvoiceTransactions.length === 0 ? (
                  <div className="p-8 text-center rounded-xl bg-secondary/20 border border-dashed border-border/60">
                    <CreditCard className="w-6 h-6 text-muted-foreground mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">
                      Nenhuma transação lançada neste cartão para o mês selecionado.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {currentInvoiceTransactions.map((tx) => (
                      <div
                        key={tx.id}
                        className="p-3 rounded-xl bg-secondary/30 border border-border/60 flex items-center justify-between text-xs hover:bg-secondary/50 transition-colors"
                      >
                        <div className="flex items-center gap-3 min-w-0 pr-2">
                          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
                            {format(parseISO(tx.date), 'dd/MM')}
                          </span>
                          <div className="min-w-0">
                            <span className="font-semibold text-foreground truncate block">
                              {tx.description}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {tx.category_name || 'Geral'}
                            </span>
                          </div>
                        </div>

                        <span className="font-bold text-rose-400 tabular-nums shrink-0">
                          {formatMoney(Number(tx.amount))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </main>

        <MobileBottomNav />
      </div>

      {/* Modal de Adicionar / Editar Cartão */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        accountToEdit={accountToEdit}
        onSave={handleSaveAccount}
        onDelete={handleDeleteCard}
      />

      {/* Modal Interativo de Pagamento de Fatura */}
      {isPayInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-card border border-border rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/70">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
                  <CheckCircle2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Pagar Fatura</h3>
                  <p className="text-[10px] text-muted-foreground">{currentCard?.name}</p>
                </div>
              </div>
              <button
                onClick={() => setIsPayInvoiceModalOpen(false)}
                className="p-1 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmPayInvoice} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Valor do Pagamento (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-semibold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={payAmount}
                    onChange={(e) => setPayAmount((prev) => maskCurrency(e.target.value, prev))}
                    placeholder="0,00"
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-secondary/50 border border-border text-foreground text-sm font-bold font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  />
                </div>
                <span className="text-[10px] text-muted-foreground mt-0.5 block">
                  Valor total da fatura atual: {formatMoney(currentInvoiceTotal)}
                </span>
              </div>

              <div>
                <label className="text-xs font-semibold text-foreground block mb-1">
                  Debitar de qual Conta Corrente?
                </label>
                {checkingAccounts.length === 0 ? (
                  <p className="text-xs text-rose-400">
                    Nenhuma conta corrente cadastrada para debitar o valor.
                  </p>
                ) : (
                  <select
                    value={sourceAccountId}
                    onChange={(e) => setSourceAccountId(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border text-foreground text-xs focus:outline-none focus:ring-2 focus:ring-primary"
                    required
                  >
                    {checkingAccounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} (Saldo: {formatMoney(Number(acc.balance))})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div className="p-3 rounded-xl bg-secondary/30 border border-border/50 text-[11px] text-muted-foreground flex items-center gap-2">
                <Info className="w-4 h-4 text-primary shrink-0" />
                <span>
                  O pagamento registrará a despesa na conta selecionada e liberará o limite correspondente no cartão.
                </span>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsPayInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingPay || checkingAccounts.length === 0}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSubmittingPay ? 'Processando...' : 'Confirmar Pagamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
