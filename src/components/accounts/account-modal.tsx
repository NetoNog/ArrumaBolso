'use client';

import React, { useState, useEffect } from 'react';
import { X, Wallet, CreditCard, TrendingUp, PiggyBank, Banknote, Trash2, Check } from 'lucide-react';
import { AccountAndCard, AccountType } from '@/lib/supabase/types';
import { toast } from 'sonner';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  accountToEdit?: AccountAndCard | null;
  onSave: (account: Omit<AccountAndCard, 'id'>, id?: string) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
}

const INSTITUTIONS = [
  { name: 'Nubank', color: '#820AD1' },
  { name: 'Inter', color: '#FF7A00' },
  { name: 'Itaú', color: '#EC7000' },
  { name: 'Bradesco', color: '#CC092F' },
  { name: 'Santander', color: '#EA1D2C' },
  { name: 'Banco do Brasil', color: '#003882' },
  { name: 'C6 Bank', color: '#242424' },
  { name: 'XP Investimentos', color: '#F59E0B' },
  { name: 'BTG Pactual', color: '#001E62' },
  { name: 'Outra Instituição', color: '#6366F1' },
];

export function AccountModal({
  isOpen,
  onClose,
  accountToEdit,
  onSave,
  onDelete,
}: AccountModalProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<AccountType>('checking');
  const [institution, setInstitution] = useState('Nubank');
  const [balance, setBalance] = useState('');
  const [creditLimit, setCreditLimit] = useState('');
  const [closingDay, setClosingDay] = useState('25');
  const [dueDay, setDueDay] = useState('3');
  const [color, setColor] = useState('#820AD1');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (accountToEdit) {
      setName(accountToEdit.name);
      setType(accountToEdit.type);
      setInstitution(accountToEdit.institution || 'Nubank');
      setBalance(accountToEdit.balance !== undefined && accountToEdit.balance !== null ? formatNumberToCurrencyInput(accountToEdit.balance) : '');
      setCreditLimit(accountToEdit.credit_limit ? formatNumberToCurrencyInput(accountToEdit.credit_limit) : '');
      setClosingDay(accountToEdit.closing_day ? String(accountToEdit.closing_day) : '25');
      setDueDay(accountToEdit.due_day ? String(accountToEdit.due_day) : '3');
      setColor(accountToEdit.color || '#820AD1');
    } else {
      setName('');
      setType('checking');
      setInstitution('Nubank');
      setBalance('');
      setCreditLimit('');
      setClosingDay('25');
      setDueDay('3');
      setColor('#820AD1');
    }
  }, [accountToEdit, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Informe o nome da conta ou cartão.');
      return;
    }

    const parsedBalance = parseCurrency(balance);
    const parsedLimit = creditLimit ? parseCurrency(creditLimit) : undefined;

    try {
      setIsSubmitting(true);
      await onSave({
        name: name.trim(),
        type,
        institution,
        balance: isNaN(parsedBalance) ? 0 : parsedBalance,
        credit_limit: parsedLimit,
        closing_day: type === 'credit_card' ? parseInt(closingDay, 10) : undefined,
        due_day: type === 'credit_card' ? parseInt(dueDay, 10) : undefined,
        color,
        icon: type === 'credit_card' ? 'credit-card' : type === 'investment' ? 'trending-up' : 'wallet',
        is_active: true,
      }, accountToEdit?.id);

      toast.success(accountToEdit ? 'Conta atualizada com sucesso!' : 'Conta criada com sucesso!');
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao salvar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!accountToEdit || !onDelete) return;
    if (confirm(`Deseja realmente excluir a conta "${accountToEdit.name}"?`)) {
      try {
        setIsSubmitting(true);
        await onDelete(accountToEdit.id);
        toast.success('Conta excluída com sucesso.');
        onClose();
      } catch (err: any) {
        toast.error('Erro ao excluir conta.');
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-sm">
      <div className="bg-card border-t sm:border border-border/80 rounded-t-3xl sm:rounded-xl w-full max-w-md shadow-xl overflow-hidden max-h-[92dvh] overflow-y-auto animate-in slide-in-from-bottom sm:slide-in-from-bottom-0 sm:fade-in-0 sm:zoom-in-95 duration-200">
        {/* Mobile Pull Handle */}
        <div className="sm:hidden pt-3 pb-1 flex justify-center bg-card shrink-0">
          <div className="w-10 h-1.5 bg-muted-foreground/30 rounded-full" />
        </div>

        <div className="px-5 py-4 border-b border-border/70 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-sm text-foreground">
              {accountToEdit ? 'Editar Conta / Cartão' : 'Nova Conta ou Cartão'}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {/* Tipo de Conta */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1.5">
              Tipo
            </label>
            <div className="grid grid-cols-3 gap-1 p-0.5 bg-secondary/60 rounded-lg border border-border/70 text-xs font-medium">
              <button
                type="button"
                onClick={() => setType('checking')}
                className={`py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  type === 'checking' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <Wallet className="w-3.5 h-3.5" />
                Conta
              </button>
              <button
                type="button"
                onClick={() => setType('credit_card')}
                className={`py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  type === 'credit_card' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <CreditCard className="w-3.5 h-3.5" />
                Cartão
              </button>
              <button
                type="button"
                onClick={() => setType('investment')}
                className={`py-1.5 px-1 rounded-md transition-all flex items-center justify-center gap-1.5 ${
                  type === 'investment' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" />
                Investimento
              </button>
            </div>
          </div>

          {/* Instituição e Cor */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Instituição
              </label>
              <select
                value={institution}
                onChange={(e) => {
                  setInstitution(e.target.value);
                  const inst = INSTITUTIONS.find(i => i.name === e.target.value);
                  if (inst) setColor(inst.color);
                }}
                className="w-full bg-secondary/40 text-foreground text-xs p-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors cursor-pointer"
              >
                {INSTITUTIONS.map(inst => (
                  <option key={inst.name} value={inst.name} className="bg-card text-foreground">{inst.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-xs font-medium text-muted-foreground block mb-1">
                Cor de Destaque
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border/80 cursor-pointer bg-transparent"
                />
                <span className="text-xs text-muted-foreground font-mono">{color}</span>
              </div>
            </div>
          </div>

          {/* Nome da Conta */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              Nome de Identificação
            </label>
            <input
              type="text"
              placeholder="Ex: Conta Principal Nubank, Cartão Black..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-secondary/40 text-foreground text-xs p-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors"
              required
            />
          </div>

          {/* Saldo Atual */}
          <div>
            <label className="text-xs font-medium text-muted-foreground block mb-1">
              {type === 'credit_card' ? 'Fatura Aberta Atual (R$)' : 'Saldo Atual (R$)'}
            </label>
            <div className="relative">
              <span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground">R$</span>
              <input
                type="text"
                inputMode="numeric"
                placeholder={type === 'credit_card' ? '-1.250,00' : '0,00'}
                value={balance}
                onChange={(e) => setBalance((prev) => maskCurrency(e.target.value, prev))}
                className="w-full bg-secondary/40 text-foreground text-xs font-semibold pl-9 pr-3 py-2 rounded-lg border border-border/80 focus:outline-none focus:border-primary transition-colors font-mono tabular-nums"
              />
            </div>
            {type === 'credit_card' && (
              <span className="text-[10px] text-muted-foreground mt-1 block">
                Para faturas a pagar, utilize valor negativo (ex: -1.250,00).
              </span>
            )}
          </div>

          {/* Campos exclusivos para Cartão de Crédito */}
          {type === 'credit_card' && (
            <div className="p-3 rounded-lg bg-secondary/30 border border-border/70 space-y-2.5">
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-1">
                  Limite Total do Cartão (R$)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-semibold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="15.000,00"
                    value={creditLimit}
                    onChange={(e) => setCreditLimit((prev) => maskCurrency(e.target.value, prev))}
                    className="w-full bg-card text-foreground text-xs pl-9 pr-3 py-1.5 rounded-lg border border-border/80 focus:outline-none focus:border-primary font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Dia de Fechamento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={closingDay}
                    onChange={(e) => setClosingDay(e.target.value)}
                    className="w-full bg-card text-foreground text-xs p-1.5 rounded-lg border border-border/80 focus:outline-none focus:border-primary"
                  />
                </div>
                <div>
                  <label className="text-[11px] text-muted-foreground block mb-1">Dia de Vencimento</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    value={dueDay}
                    onChange={(e) => setDueDay(e.target.value)}
                    className="w-full bg-card text-foreground text-xs p-1.5 rounded-lg border border-border/80 focus:outline-none focus:border-primary"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between pt-3 border-t border-border/70">
            {accountToEdit && onDelete ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSubmitting}
                className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg text-xs font-medium transition-colors flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Excluir
              </button>
            ) : <div />}

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3.5 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-1.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all disabled:opacity-50 active:scale-[0.98]"
              >
                {isSubmitting ? 'Salvando...' : accountToEdit ? 'Atualizar Conta' : 'Criar Conta'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
