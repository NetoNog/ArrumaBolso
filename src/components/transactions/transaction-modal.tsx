'use client';

import React, { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { 
  X, 
  Calendar, 
  Layers, 
  Repeat, 
  DollarSign, 
  AlertCircle, 
  CheckCircle2, 
  Clock, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Sparkles,
  Calculator
} from 'lucide-react';
import { Category, AccountAndCard, TransactionType, Transaction, TransactionStatus } from '@/lib/supabase/types';
import { sanitizeText } from '@/lib/parsers/nubank-parser';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';
import { toast } from 'sonner';

export function evaluateMathExpression(input: string): number | null {
  if (!input) return null;
  const sanitized = input.trim().replace(/,/g, '.');
  if (!/^[\d\.\s\+\-\*\/\(\)]+$/.test(sanitized)) return null;

  try {
    const cleanExpr = sanitized.replace(/\s+/g, '');
    if (!cleanExpr) return null;
    if (/[^0-9\.\+\-\*\/\(\)]/.test(cleanExpr)) return null;
    if (/[\+\-\*\/]$/.test(cleanExpr)) return null;

    const fn = new Function(`"use strict"; return (${cleanExpr});`);
    const result = fn();
    if (typeof result === 'number' && !isNaN(result) && isFinite(result)) {
      return Math.round(result * 100) / 100;
    }
  } catch {
    return null;
  }
  return null;
}

const transactionSchema = z.object({
  description: z.string().min(2, 'A descrição deve ter pelo menos 2 caracteres'),
  amount: z.string().min(1, 'Informe um valor').refine((val) => {
    const num = parseCurrency(val);
    return !isNaN(num) && num > 0;
  }, 'Informe um valor válido maior que zero (ex: 45,90 ou 100+25)'),
  date: z.string().min(1, 'Informe a data'),
  due_date: z.string().optional(),
  type: z.enum(['expense', 'income', 'investment']),
  status: z.enum(['completed', 'pending', 'cancelled']).default('completed'),
  payment_method: z.string().default('PIX'),
  category_id: z.string().min(1, 'Selecione uma categoria'),
  account_id: z.string().min(1, 'Selecione uma conta ou cartão'),
  isInstallment: z.boolean().default(false),
  installmentCurrent: z.coerce.number().min(1).max(60).default(1),
  installmentTotal: z.coerce.number().min(2).max(60).default(10),
  generateFutureInstallments: z.boolean().default(true),
  isRecurring: z.boolean().default(false),
});

type TransactionFormValues = z.infer<typeof transactionSchema>;

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  categories: Category[];
  accounts: AccountAndCard[];
  initialType?: 'expense' | 'income' | 'investment';
  transactionToEdit?: Transaction | null;
  onSave: (tx: Omit<Transaction, 'id'>, generateInstallments: boolean) => Promise<void>;
  onUpdate?: (tx: Transaction) => Promise<void>;
}

export function TransactionModal({
  isOpen,
  onClose,
  categories,
  accounts,
  initialType = 'expense',
  transactionToEdit,
  onSave,
  onUpdate
}: TransactionModalProps) {
  const defaultCategoryId = categories[0]?.id || '';
  const defaultAccountId = accounts[0]?.id || '';

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<TransactionFormValues>({
    resolver: zodResolver(transactionSchema) as any,
    defaultValues: {
      description: '',
      amount: '',
      date: new Date().toISOString().split('T')[0],
      due_date: new Date().toISOString().split('T')[0],
      type: initialType,
      status: 'completed',
      payment_method: 'PIX',
      category_id: defaultCategoryId,
      account_id: defaultAccountId,
      isInstallment: false,
      installmentCurrent: 1,
      installmentTotal: 10,
      generateFutureInstallments: true,
      isRecurring: false,
    }
  });

  const currentType = watch('type');
  const currentStatus = watch('status');
  const isInstallment = watch('isInstallment');
  const isRecurring = watch('isRecurring');
  const rawAmount = watch('amount') || '';
  const hasOperator = /[+\-*/]/.test(rawAmount);
  const mathResult = hasOperator ? evaluateMathExpression(rawAmount) : null;

  useEffect(() => {
    if (transactionToEdit) {
      const cat = categories.find(c => c.name === transactionToEdit.category_name || c.id === transactionToEdit.category_id);
      setValue('description', transactionToEdit.description);
      setValue('amount', formatNumberToCurrencyInput(transactionToEdit.amount));
      setValue('date', transactionToEdit.date);
      setValue('due_date', transactionToEdit.due_date || transactionToEdit.date);
      setValue('type', transactionToEdit.type as 'expense' | 'income' | 'investment');
      setValue('status', transactionToEdit.status);
      setValue('payment_method', transactionToEdit.payment_method || 'PIX');
      if (cat) setValue('category_id', cat.id);
      if (transactionToEdit.account_id) setValue('account_id', transactionToEdit.account_id);
      setValue('isInstallment', !!(transactionToEdit.installment_total && transactionToEdit.installment_total > 1));
      setValue('installmentCurrent', transactionToEdit.installment_current || 1);
      setValue('installmentTotal', transactionToEdit.installment_total || 10);
      setValue('isRecurring', !!transactionToEdit.is_recurring);
    } else {
      reset({
        description: '',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        due_date: new Date().toISOString().split('T')[0],
        type: initialType,
        status: 'completed',
        payment_method: 'PIX',
        category_id: defaultCategoryId,
        account_id: defaultAccountId,
        isInstallment: false,
        installmentCurrent: 1,
        installmentTotal: 10,
        generateFutureInstallments: true,
        isRecurring: false,
      });
    }
  }, [transactionToEdit, initialType, defaultCategoryId, defaultAccountId, categories, setValue, reset, isOpen]);

  if (!isOpen) return null;

  const onSubmit = async (values: TransactionFormValues) => {
    const parsedAmount = parseCurrency(values.amount);
    const categoryObj = categories.find(c => c.id === values.category_id);

    try {
      if (transactionToEdit && onUpdate) {
        await onUpdate({
          ...transactionToEdit,
          date: values.date,
          due_date: values.due_date || values.date,
          description: sanitizeText(values.description.trim()),
          amount: parsedAmount,
          type: values.type,
          status: values.status,
          payment_method: values.payment_method,
          category_id: values.category_id,
          category_name: categoryObj ? categoryObj.name : 'Geral',
          account_id: values.account_id,
          installment_current: values.isInstallment ? values.installmentCurrent : undefined,
          installment_total: values.isInstallment ? values.installmentTotal : undefined,
          is_recurring: values.isRecurring,
          recurrence_interval: values.isRecurring ? 'monthly' : undefined,
        });
        toast.success('Transação atualizada com sucesso!');
      } else {
        await onSave({
          date: values.date,
          due_date: values.due_date || values.date,
          description: sanitizeText(values.description.trim()),
          amount: parsedAmount,
          type: values.type,
          status: values.status,
          payment_method: values.payment_method,
          category_id: values.category_id,
          category_name: categoryObj ? categoryObj.name : 'Geral',
          account_id: values.account_id,
          installment_current: values.isInstallment ? values.installmentCurrent : undefined,
          installment_total: values.isInstallment ? values.installmentTotal : undefined,
          is_recurring: values.isRecurring,
          recurrence_interval: values.isRecurring ? 'monthly' : undefined,
          imported_via_csv: false
        }, values.isInstallment && values.generateFutureInstallments);
        toast.success(values.type === 'income' ? 'Receita cadastrada com sucesso!' : 'Despesa cadastrada com sucesso!');
      }

      reset();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar transação.');
    }
  };

  const isIncome = currentType === 'income';
  const isExpense = currentType === 'expense';

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border-t sm:border border-border/80 rounded-t-3xl sm:rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[92dvh] animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 duration-200">
        {/* Mobile Pull Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center bg-card shrink-0">
          <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        {/* Header */}
        <div className={`px-4 sm:px-6 py-3.5 sm:py-4 border-b border-border/70 flex items-center justify-between shrink-0 ${
          isIncome ? 'bg-emerald-500/5' : isExpense ? 'bg-rose-500/5' : 'bg-primary/5'
        }`}>
          <div className="flex items-center gap-2.5">
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              isIncome 
                ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                : isExpense 
                ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' 
                : 'bg-primary/20 text-primary'
            }`}>
              {isIncome ? <ArrowUpRight className="w-5 h-5" /> : isExpense ? <ArrowDownRight className="w-5 h-5" /> : <Sparkles className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="font-bold text-base text-foreground">
                {transactionToEdit 
                  ? 'Editar Transação' 
                  : isIncome 
                  ? 'Nova Receita / Entrada' 
                  : isExpense 
                  ? 'Nova Despesa / Saída' 
                  : 'Novo Investimento / Meta'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {transactionToEdit ? 'Atualize as informações financeiras' : 'Preencha os detalhes da movimentação'}
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              reset();
              onClose();
            }}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit(onSubmit)} className="p-4 sm:p-6 space-y-4 overflow-y-auto flex-1">
          {/* Type Selector (Segmented) */}
          <div className="grid grid-cols-3 gap-1 p-1 bg-secondary/70 rounded-xl border border-border/70 text-xs">
            <button
              type="button"
              onClick={() => setValue('type', 'expense')}
              className={`py-2 rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 ${
                currentType === 'expense' 
                  ? 'bg-rose-500 text-white shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowDownRight className="w-3.5 h-3.5" />
              Despesa
            </button>
            <button
              type="button"
              onClick={() => setValue('type', 'income')}
              className={`py-2 rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 ${
                currentType === 'income' 
                  ? 'bg-emerald-600 text-white shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArrowUpRight className="w-3.5 h-3.5" />
              Receita
            </button>
            <button
              type="button"
              onClick={() => setValue('type', 'investment')}
              className={`py-2 rounded-lg transition-all font-semibold flex items-center justify-center gap-1.5 ${
                currentType === 'investment' 
                  ? 'bg-primary text-white shadow-sm' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Investimento
            </button>
          </div>

          {/* Valor e Data */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-foreground">
                  Valor (R$) *
                </label>
                {hasOperator && (
                  <span className="text-[10px] text-emerald-400 flex items-center gap-1 font-mono">
                    <Calculator className="w-3 h-3 text-emerald-400" />
                    Calculadora ativa
                  </span>
                )}
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-2.5 text-xs font-bold text-muted-foreground">R$</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0,00 ou ex: 120+45"
                  value={rawAmount}
                  onChange={(e) => {
                    const raw = e.target.value;
                    const masked = maskCurrency(raw, rawAmount);
                    setValue('amount', masked, { shouldValidate: true });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && mathResult !== null) {
                      e.preventDefault();
                      setValue('amount', formatNumberToCurrencyInput(mathResult), { shouldValidate: true });
                    }
                  }}
                  onBlur={() => {
                    if (mathResult !== null) {
                      setValue('amount', formatNumberToCurrencyInput(mathResult), { shouldValidate: true });
                    }
                  }}
                  className={`w-full bg-secondary/40 text-foreground text-sm font-bold pl-10 pr-3 py-2.5 rounded-xl border focus:outline-none transition-colors tabular-nums ${
                    errors.amount ? 'border-destructive' : 'border-border/80 focus:border-primary'
                  }`}
                />
              </div>
              {mathResult !== null && (
                <button
                  type="button"
                  onClick={() => setValue('amount', formatNumberToCurrencyInput(mathResult), { shouldValidate: true })}
                  className="mt-1.5 text-[11px] text-emerald-400 font-medium bg-emerald-500/10 px-2.5 py-1.5 rounded-lg border border-emerald-500/20 flex items-center gap-1.5 hover:bg-emerald-500/20 transition-colors w-full text-left"
                >
                  <Calculator className="w-3.5 h-3.5 shrink-0 text-emerald-400" />
                  <span>Resultado: <strong>R$ {mathResult.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> (clique para aplicar)</span>
                </button>
              )}
              {errors.amount && (
                <span className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.amount.message}
                </span>
              )}
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Data do Registro *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3.5 top-2.5 w-4 h-4 text-muted-foreground" />
                <input
                  type="date"
                  {...register('date')}
                  className="w-full bg-secondary/40 text-foreground text-xs font-medium pl-10 pr-3 py-2.5 rounded-xl border border-border/80 focus:outline-none focus:border-primary transition-colors"
                />
              </div>
              {errors.date && (
                <span className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {errors.date.message}
                </span>
              )}
            </div>
          </div>

          {/* Status (Pago/Recebido vs Pendente) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Situação / Status
              </label>
              <div className="grid grid-cols-2 gap-1.5 p-1 bg-secondary/50 rounded-xl border border-border/70 text-xs">
                <button
                  type="button"
                  onClick={() => setValue('status', 'completed')}
                  className={`py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
                    currentStatus === 'completed'
                      ? 'bg-card text-emerald-600 dark:text-emerald-400 font-bold shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  {isIncome ? 'Recebido' : 'Pago'}
                </button>
                <button
                  type="button"
                  onClick={() => setValue('status', 'pending')}
                  className={`py-1.5 px-2 rounded-lg font-medium flex items-center justify-center gap-1 transition-all ${
                    currentStatus === 'pending'
                      ? 'bg-card text-amber-600 dark:text-amber-400 font-bold shadow-xs border border-border/60'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {isIncome ? 'A Receber' : 'A Pagar'}
                </button>
              </div>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Forma de Pagamento
              </label>
              <select
                {...register('payment_method')}
                className="w-full bg-secondary/40 text-foreground text-xs py-2.5 px-3 rounded-xl border border-border/80 focus:outline-none focus:border-primary cursor-pointer transition-colors"
              >
                <option value="PIX">PIX</option>
                <option value="Cartão de Crédito">Cartão de Crédito</option>
                <option value="Cartão de Débito">Cartão de Débito</option>
                <option value="Boleto Bancário">Boleto Bancário</option>
                <option value="Transferência (TED/DOC)">Transferência (TED/DOC)</option>
                <option value="Dinheiro">Dinheiro Físico</option>
                <option value="Débito Automático">Débito Automático</option>
              </select>
            </div>
          </div>

          {/* Descrição */}
          <div>
            <label className="text-xs font-semibold text-foreground block mb-1">
              Descrição / Identificação *
            </label>
            <input
              type="text"
              placeholder={isIncome ? 'Ex: Salário Mensal, Freelance Projeto X, Venda...' : 'Ex: Supermercado Pão de Açúcar, Aluguel, Posto Shell...'}
              {...register('description')}
              className={`w-full bg-secondary/40 text-foreground text-xs px-3.5 py-2.5 rounded-xl border focus:outline-none transition-colors ${
                errors.description ? 'border-destructive' : 'border-border/80 focus:border-primary'
              }`}
            />
            {errors.description && (
              <span className="text-[11px] text-destructive mt-1 flex items-center gap-1">
                <AlertCircle className="w-3 h-3" /> {errors.description.message}
              </span>
            )}
          </div>

          {/* Categoria e Conta */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Categoria
              </label>
              <select
                {...register('category_id')}
                className="w-full bg-secondary/40 text-foreground text-xs py-2.5 px-3 rounded-xl border border-border/80 focus:outline-none focus:border-primary cursor-pointer transition-colors"
              >
                {categories
                  .filter(c => (isIncome ? c.type === 'income' : isExpense ? c.type === 'expense' : true))
                  .map(c => (
                    <option key={c.id} value={c.id} className="bg-card text-foreground">{c.name}</option>
                  ))}
                {categories
                  .filter(c => (isIncome ? c.type !== 'income' : isExpense ? c.type !== 'expense' : false))
                  .map(c => (
                    <option key={c.id} value={c.id} className="bg-card text-foreground">{c.name}</option>
                  ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-semibold text-foreground block mb-1">
                Conta / Carteira
              </label>
              <select
                {...register('account_id')}
                className="w-full bg-secondary/40 text-foreground text-xs py-2.5 px-3 rounded-xl border border-border/80 focus:outline-none focus:border-primary cursor-pointer transition-colors"
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id} className="bg-card text-foreground">{a.name} ({a.institution})</option>
                ))}
              </select>
            </div>
          </div>

          {/* Compra Parcelada Toggle (se despesa) */}
          {currentType === 'expense' && !transactionToEdit && (
            <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/70 space-y-2.5">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  {...register('isInstallment')}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                />
                <Layers className="w-3.5 h-3.5 text-muted-foreground" />
                <span>Compra Parcelada no Cartão</span>
              </label>

              {isInstallment && (
                <div className="pt-2 border-t border-border/60 space-y-2.5">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">Parcela Atual:</span>
                      <input
                        type="number"
                        min="1"
                        max="60"
                        {...register('installmentCurrent')}
                        className="w-full bg-card text-foreground text-xs p-2 rounded-lg border border-border/80"
                      />
                    </div>
                    <div>
                      <span className="text-[11px] text-muted-foreground block mb-1">Total de Parcelas:</span>
                      <input
                        type="number"
                        min="2"
                        max="60"
                        {...register('installmentTotal')}
                        className="w-full bg-card text-foreground text-xs p-2 rounded-lg border border-border/80"
                      />
                    </div>
                  </div>

                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                    <input
                      type="checkbox"
                      {...register('generateFutureInstallments')}
                      className="rounded border-border text-primary focus:ring-primary w-3.5 h-3.5"
                    />
                    <span>Gerar lançamentos automáticos para os próximos meses</span>
                  </label>
                </div>
              )}
            </div>
          )}

          {/* Despesa Fixa Recorrente */}
          {!transactionToEdit && (
            <div className="flex items-center justify-between text-xs text-muted-foreground p-3 rounded-xl bg-secondary/30 border border-border/70">
              <label className="flex items-center gap-2 cursor-pointer font-medium text-foreground">
                <input
                  type="checkbox"
                  {...register('isRecurring')}
                  className="rounded border-border text-primary focus:ring-primary w-4 h-4"
                />
                <Repeat className="w-3.5 h-3.5 text-muted-foreground" />
                Compromisso Recorrente Mensal (Gasto Fixo)
              </label>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2.5 pt-3 pb-2 sm:pb-0 border-t border-border/70 sticky bottom-0 bg-card/95 backdrop-blur-md -mx-4 -mb-4 px-4 py-3 sm:relative sm:mx-0 sm:mb-0 sm:p-0 sm:pt-4 sm:bg-transparent">
            <button
              type="button"
              onClick={() => {
                reset();
                onClose();
              }}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={`flex-1 sm:flex-none px-5 py-2.5 rounded-xl text-white text-xs font-bold shadow-md transition-all disabled:opacity-50 active:scale-[0.98] ${
                isIncome 
                  ? 'bg-emerald-600 hover:bg-emerald-700' 
                  : isExpense 
                  ? 'bg-rose-600 hover:bg-rose-700' 
                  : 'bg-primary hover:bg-primary/90'
              }`}
            >
              {isSubmitting 
                ? 'Salvando...' 
                : transactionToEdit 
                ? 'Atualizar Transação' 
                : isIncome 
                ? 'Salvar Receita' 
                : isExpense 
                ? 'Salvar Despesa' 
                : 'Salvar Investimento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
