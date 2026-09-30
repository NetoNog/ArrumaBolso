export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type TransactionType = 'income' | 'expense' | 'transfer' | 'investment';
export type TransactionStatus = 'completed' | 'pending' | 'cancelled';
export type AccountType = 'checking' | 'credit_card' | 'investment' | 'cash' | 'savings';
export type RecurrenceInterval = 'weekly' | 'monthly' | 'quarterly' | 'yearly';
export type UserRole = 'admin' | 'user';
export type UserAccountStatus = 'active' | 'pending' | 'blocked';

export interface Profile {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
  currency: string;
  locale: string;
  timezone: string;
  base_monthly_income: number;
  salary_day: number;
  role: UserRole;
  status: UserAccountStatus;
  created_at: string;
  updated_at: string;
  theme_accent?: string;
  default_privacy_mode?: boolean;
  hide_cents?: boolean;
  spending_alert_threshold?: number;
}

export interface Category {
  id: string;
  user_id?: string;
  name: string;
  slug: string;
  icon: string;
  color: string;
  type: 'expense' | 'income' | 'investment';
  is_system?: boolean;
  monthly_budget_cap: number;
  created_at?: string;
  updated_at?: string;
}

export interface AccountAndCard {
  id: string;
  user_id?: string;
  name: string;
  type: AccountType;
  institution: string;
  balance: number;
  credit_limit?: number;
  closing_day?: number;
  due_day?: number;
  color: string;
  icon: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Transaction {
  id: string;
  user_id?: string;
  account_id?: string;
  category_id?: string;
  category_name: string;
  date: string; // YYYY-MM-DD
  description: string;
  original_title?: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  
  // Parcelas
  installment_current?: number;
  installment_total?: number;
  installment_group_id?: string;

  // Recorrência
  is_recurring: boolean;
  recurrence_interval?: RecurrenceInterval;

  // Importação e Anti-Duplicação
  imported_via_csv: boolean;
  csv_hash?: string;
  
  // Pagamento e Vencimento
  due_date?: string;
  payment_method?: string;

  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export interface MonthlyBudget {
  id: string;
  user_id?: string;
  category_id: string;
  year: number;
  month: number;
  budgeted_amount: number;
  alert_threshold_percentage: number;
  created_at?: string;
  updated_at?: string;
}

export interface FinancialGoal {
  id: string;
  user_id?: string;
  title: string;
  description?: string;
  target_amount: number;
  current_amount: number;
  monthly_contribution: number;
  deadline_date?: string;
  icon: string;
  color: string;
  is_completed: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface FixedExpense {
  id: string;
  user_id?: string;
  name: string;
  amount: number;
  due_day: number;
  category_id?: string;
  category_name: string;
  account_id?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface Debt {
  id: string;
  user_id?: string;
  title: string;
  creditor: string;
  total_amount: number;
  monthly_installment: number;
  total_installments: number;
  paid_installments: number;
  interest_rate?: number;
  due_day?: number;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}
