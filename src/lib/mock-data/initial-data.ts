import { Category, AccountAndCard, Transaction, MonthlyBudget, FinancialGoal, Profile } from '../supabase/types';

export const INITIAL_PROFILE: Profile = {
  id: 'usr_default',
  email: '',
  full_name: 'Minhas Finanças',
  avatar_url: null,
  currency: 'BRL',
  locale: 'pt-BR',
  timezone: 'America/Fortaleza',
  base_monthly_income: 0,
  salary_day: 5,
  role: 'user',
  status: 'active',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString()
};

export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat_01', name: 'Alimentação & Supermercado', slug: 'alimentacao', icon: 'utensils', color: '#f97316', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_02', name: 'Moradia & Contas', slug: 'moradia', icon: 'home', color: '#3b82f6', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_03', name: 'Transporte & Combustível', slug: 'transporte', icon: 'car', color: '#06b6d4', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_04', name: 'Assinaturas & Serviços', slug: 'assinaturas', icon: 'sparkles', color: '#4F46E5', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_05', name: 'Lazer & Restaurantes', slug: 'lazer', icon: 'coffee', color: '#ec4899', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_06', name: 'Saúde & Farmácia', slug: 'saude', icon: 'heart-pulse', color: '#E11D48', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_07', name: 'Educação & Cursos', slug: 'educacao', icon: 'graduation-cap', color: '#14b8a6', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_08', name: 'Compras & Eletrônicos', slug: 'compras', icon: 'shopping-bag', color: '#818cf8', type: 'expense', monthly_budget_cap: 0 },
  { id: 'cat_09', name: 'Salário & Remuneração', slug: 'salario', icon: 'briefcase', color: '#059669', type: 'income', monthly_budget_cap: 0 },
  { id: 'cat_10', name: 'Rendimentos & Dividendos', slug: 'rendimentos', icon: 'trending-up', color: '#059669', type: 'income', monthly_budget_cap: 0 },
  { id: 'cat_11', name: 'Reserva de Emergência', slug: 'reserva', icon: 'shield-check', color: '#F59E0B', type: 'investment', monthly_budget_cap: 0 },
  { id: 'cat_12', name: 'Investimentos em Ações/FIIs', slug: 'investimentos', icon: 'line-chart', color: '#047857', type: 'investment', monthly_budget_cap: 0 },
];

export const INITIAL_ACCOUNTS: AccountAndCard[] = [
  {
    id: 'acc_nubank_conta',
    name: 'Conta Corrente Nubank',
    type: 'checking',
    institution: 'Nubank',
    balance: 0.00,
    color: '#4F46E5',
    icon: 'wallet',
    is_active: true
  },
  {
    id: 'acc_nubank_cartao',
    name: 'Cartão de Crédito Nubank',
    type: 'credit_card',
    institution: 'Nubank',
    balance: 0.00,
    credit_limit: 0.00,
    closing_day: 25,
    due_day: 3,
    color: '#4F46E5',
    icon: 'credit-card',
    is_active: true
  }
];

// Transações 100% limpas para uso real do usuário
export const INITIAL_TRANSACTIONS: Transaction[] = [];

// Metas limpas para o usuário cadastrar seus próprios objetivos
export const INITIAL_GOALS: FinancialGoal[] = [];

// Orçamentos limpos para definição pelo usuário
export const INITIAL_BUDGETS: MonthlyBudget[] = [];

// Gastos Fixos recorrentes
export const INITIAL_FIXED_EXPENSES: any[] = [];

// Dívidas e parcelamentos
export const INITIAL_DEBTS: any[] = [];
