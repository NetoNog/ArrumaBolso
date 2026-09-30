'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { FinancialService } from '@/lib/services/financial-service';
import { 
  Transaction, 
  AccountAndCard, 
  Category, 
  MonthlyBudget, 
  FinancialGoal, 
  FixedExpense,
  Debt,
  Profile 
} from '@/lib/supabase/types';
import { ParsedNubankItem } from '@/lib/parsers/nubank-parser';

export const QUERY_KEYS = {
  PROFILE: ['profile'] as const,
  ACCOUNTS: ['accounts'] as const,
  CATEGORIES: ['categories'] as const,
  TRANSACTIONS: ['transactions'] as const,
  BUDGETS: ['budgets'] as const,
  GOALS: ['goals'] as const,
  FIXED_EXPENSES: ['fixed_expenses'] as const,
  DEBTS: ['debts'] as const,
};

/**
 * Hook reativo que rastreia o ID do usuário atualmente autenticado
 * e notifica os componentes quando ocorre alternância de contas.
 */
export function useActiveUserId(): string {
  const [userId, setUserId] = useState<string>(() => FinancialService.getActiveUserId());

  useEffect(() => {
    const handleSignOut = () => setUserId('');
    const handleSignIn = (e: any) => {
      const uid = e?.detail?.userId || FinancialService.getActiveUserId();
      setUserId(uid);
    };

    window.addEventListener('gf_auth_signout', handleSignOut);
    window.addEventListener('gf_auth_signin', handleSignIn as EventListener);

    const timer = setInterval(() => {
      const current = FinancialService.getActiveUserId();
      setUserId(prev => (prev !== current ? current : prev));
    }, 1500);

    return () => {
      window.removeEventListener('gf_auth_signout', handleSignOut);
      window.removeEventListener('gf_auth_signin', handleSignIn as EventListener);
      clearInterval(timer);
    };
  }, []);

  return userId;
}

// ==========================================
// PROFILE
// ==========================================
export function useProfile() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.PROFILE, userId],
    queryFn: () => FinancialService.getProfile(userId),
    enabled: Boolean(userId),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (profile: Partial<Profile>) => FinancialService.updateProfile(profile),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.PROFILE });
    },
  });
}

// ==========================================
// ACCOUNTS
// ==========================================
export function useAccounts() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.ACCOUNTS, userId],
    queryFn: () => FinancialService.getAccounts(userId),
    enabled: Boolean(userId),
  });
}

export function useAddAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (acc: Omit<AccountAndCard, 'id'>) => FinancialService.addAccount(acc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

export function useUpdateAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (acc: AccountAndCard) => FinancialService.updateAccount(acc),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FinancialService.deleteAccount(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

// ==========================================
// CATEGORIES
// ==========================================
export function useCategories() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.CATEGORIES, userId],
    queryFn: () => FinancialService.getCategories(userId),
    enabled: Boolean(userId),
  });
}

export function useUpdateCategoryCap() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, cap }: { id: string; cap: number }) => 
      FinancialService.updateCategoryBudgetCap(id, cap),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.CATEGORIES });
    },
  });
}

// ==========================================
// TRANSACTIONS
// ==========================================
export function useTransactions() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.TRANSACTIONS, userId],
    queryFn: () => FinancialService.getTransactions(userId),
    enabled: Boolean(userId),
  });
}

export function useAddTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ tx, generateInstallments }: { tx: Omit<Transaction, 'id'>; generateInstallments: boolean }) =>
      FinancialService.addTransaction(tx, generateInstallments),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

export function useUpdateTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tx: Transaction) => FinancialService.updateTransaction(tx),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

export function useToggleTransactionStatus() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FinancialService.toggleTransactionStatus(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

export function useDeleteTransaction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FinancialService.deleteTransaction(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

export function useImportNubankBatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ items, accountId }: { items: ParsedNubankItem[]; accountId?: string }) =>
      FinancialService.importNubankBatch(items, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

// ==========================================
// BUDGETS & GOALS
// ==========================================
export function useBudgets() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.BUDGETS, userId],
    queryFn: () => FinancialService.getBudgets(userId),
    enabled: Boolean(userId),
  });
}

export function useGoals() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.GOALS, userId],
    queryFn: () => FinancialService.getGoals(userId),
    enabled: Boolean(userId),
  });
}

export function useAddGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goal: Omit<FinancialGoal, 'id'>) => FinancialService.addGoal(goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
    },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (goal: FinancialGoal) => FinancialService.updateGoal(goal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
    },
  });
}

export function useDeleteGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FinancialService.deleteGoal(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
    },
  });
}

export function useAddGoalContribution() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ goalId, amount, accountId }: { goalId: string; amount: number; accountId?: string }) =>
      FinancialService.addGoalContribution(goalId, amount, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.GOALS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}

// ==========================================
// GASTOS FIXOS (CONTAS RECORRENTES)
// ==========================================
export function useFixedExpenses() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.FIXED_EXPENSES, userId],
    queryFn: () => FinancialService.getFixedExpenses(userId),
    enabled: Boolean(userId),
  });
}

export function useAddFixedExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: Omit<FixedExpense, 'id'>) => FinancialService.addFixedExpense(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FIXED_EXPENSES });
    },
  });
}

export function useUpdateFixedExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: FixedExpense) => FinancialService.updateFixedExpense(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FIXED_EXPENSES });
    },
  });
}

export function useDeleteFixedExpense() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FinancialService.deleteFixedExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.FIXED_EXPENSES });
    },
  });
}

// ==========================================
// DÍVIDAS & PARCELAMENTOS
// ==========================================
export function useDebts() {
  const userId = useActiveUserId();
  return useQuery({
    queryKey: [...QUERY_KEYS.DEBTS, userId],
    queryFn: () => FinancialService.getDebts(userId),
    enabled: Boolean(userId),
  });
}

export function useAddDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: Omit<Debt, 'id'>) => FinancialService.addDebt(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DEBTS });
    },
  });
}

export function useUpdateDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (item: Debt) => FinancialService.updateDebt(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DEBTS });
    },
  });
}

export function useDeleteDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => FinancialService.deleteDebt(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DEBTS });
    },
  });
}

export function useAmortizeDebt() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ debtId, amount, accountId }: { debtId: string; amount: number; accountId?: string }) =>
      FinancialService.amortizeDebt(debtId, amount, accountId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.DEBTS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.TRANSACTIONS });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.ACCOUNTS });
    },
  });
}
