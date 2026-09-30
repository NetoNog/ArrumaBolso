-- ==============================================================================
-- PLATAFORMA DE GESTÃO FINANCEIRA PESSOAL & PREVISIBILIDADE
-- SCHEMA DE BANCO DE DADOS (SUPABASE POSTGRESQL + ROW LEVEL SECURITY - RLS)
-- Migração Inicial Completa
-- ==============================================================================

-- 1. Extensões úteis
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELA: PROFILES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT UNIQUE NOT NULL,
    full_name TEXT,
    avatar_url TEXT,
    currency TEXT DEFAULT 'BRL' NOT NULL,
    locale TEXT DEFAULT 'pt-BR' NOT NULL,
    timezone TEXT DEFAULT 'America/Fortaleza' NOT NULL,
    base_monthly_income NUMERIC(12, 2) DEFAULT 0.00,
    salary_day INTEGER DEFAULT 5 CHECK (salary_day BETWEEN 1 AND 31),
    role TEXT DEFAULT 'user' NOT NULL CHECK (role IN ('user', 'admin')),
    status TEXT DEFAULT 'active' NOT NULL CHECK (status IN ('active', 'pending', 'blocked')),
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 3. TABELA: CATEGORIES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT DEFAULT 'tag',
    color TEXT DEFAULT '#820AD1',
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'investment')),
    is_system BOOLEAN DEFAULT false,
    monthly_budget_cap NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, name, type)
);

-- ==============================================================================
-- 4. TABELA: ACCOUNTS_AND_CARDS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.accounts_and_cards (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('checking', 'credit_card', 'investment', 'cash', 'savings')),
    institution TEXT DEFAULT 'Nubank',
    balance NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    credit_limit NUMERIC(12, 2) DEFAULT 0.00,
    closing_day INTEGER CHECK (closing_day BETWEEN 1 AND 31),
    due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
    color TEXT DEFAULT '#820AD1',
    icon TEXT DEFAULT 'credit-card',
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 5. TABELA: TRANSACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    account_id UUID REFERENCES public.accounts_and_cards(id) ON DELETE SET NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT,
    date DATE NOT NULL,
    description TEXT NOT NULL,
    original_title TEXT,
    amount NUMERIC(12, 2) NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer', 'investment')),
    status TEXT DEFAULT 'completed' NOT NULL CHECK (status IN ('completed', 'pending', 'cancelled')),
    
    -- Gestão Avançada de Parcelamentos
    installment_current INTEGER,
    installment_total INTEGER,
    installment_group_id UUID,
    
    -- Gestão de Recorrência (Custos Fixos / Assinaturas)
    is_recurring BOOLEAN DEFAULT false NOT NULL,
    recurrence_interval TEXT CHECK (recurrence_interval IN ('weekly', 'monthly', 'quarterly', 'yearly', NULL)),
    
    -- Importação de CSV e Anti-Duplicação
    imported_via_csv BOOLEAN DEFAULT false NOT NULL,
    csv_hash TEXT,
    
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 6. TABELA: MONTHLY_BUDGETS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.monthly_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE NOT NULL,
    year INTEGER NOT NULL,
    month INTEGER NOT NULL CHECK (month BETWEEN 1 AND 12),
    budgeted_amount NUMERIC(12, 2) NOT NULL DEFAULT 0.00,
    alert_threshold_percentage NUMERIC(5, 2) DEFAULT 85.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, category_id, year, month)
);

-- ==============================================================================
-- 7. TABELA: FINANCIAL_GOALS (Metas & Reserva de Emergência)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.financial_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    monthly_contribution NUMERIC(12, 2) DEFAULT 0.00,
    deadline_date DATE,
    icon TEXT DEFAULT 'target',
    color TEXT DEFAULT '#10b981',
    is_completed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- ==============================================================================
-- 8. ÍNDICES DE ALTA PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_hash ON public.transactions (user_id, csv_hash) WHERE csv_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions (user_id, category_id);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions (account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_installments ON public.transactions (installment_group_id) WHERE installment_group_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_budgets_user_period ON public.monthly_budgets (user_id, year, month);
CREATE INDEX IF NOT EXISTS idx_categories_user ON public.categories (user_id);
CREATE INDEX IF NOT EXISTS idx_goals_user ON public.financial_goals (user_id);

-- ==============================================================================
-- 9. TRIGGERS AUTOMÁTICOS DE TIMESTAMPS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_current_timestamp_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS tr_profiles_updated_at ON public.profiles;
CREATE TRIGGER tr_profiles_updated_at BEFORE UPDATE ON public.profiles
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS tr_categories_updated_at ON public.categories;
CREATE TRIGGER tr_categories_updated_at BEFORE UPDATE ON public.categories
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS tr_accounts_updated_at ON public.accounts_and_cards;
CREATE TRIGGER tr_accounts_updated_at BEFORE UPDATE ON public.accounts_and_cards
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS tr_transactions_updated_at ON public.transactions;
CREATE TRIGGER tr_transactions_updated_at BEFORE UPDATE ON public.transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS tr_monthly_budgets_updated_at ON public.monthly_budgets;
CREATE TRIGGER tr_monthly_budgets_updated_at BEFORE UPDATE ON public.monthly_budgets
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

DROP TRIGGER IF EXISTS tr_financial_goals_updated_at ON public.financial_goals;
CREATE TRIGGER tr_financial_goals_updated_at BEFORE UPDATE ON public.financial_goals
    FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();

-- ==============================================================================
-- 10. TRIGGER PARA CRIAR PERFIL E CATEGORIAS PADRÃO NO SIGNUP DO SUPABASE
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- 1. Cria perfil inicial
    INSERT INTO public.profiles (id, email, full_name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;

    -- 2. Popula categorias padrão para o usuário
    INSERT INTO public.categories (user_id, name, slug, icon, color, type, is_system, monthly_budget_cap)
    VALUES
        (NEW.id, 'Alimentação & Supermercado', 'alimentacao', 'utensils', '#f97316', 'expense', false, 1800.00),
        (NEW.id, 'Moradia & Contas', 'moradia', 'home', '#3b82f6', 'expense', false, 2200.00),
        (NEW.id, 'Transporte & Combustível', 'transporte', 'car', '#06b6d4', 'expense', false, 650.00),
        (NEW.id, 'Assinaturas & Serviços', 'assinaturas', 'sparkles', '#8b5cf6', 'expense', false, 300.00),
        (NEW.id, 'Lazer & Restaurantes', 'lazer', 'coffee', '#ec4899', 'expense', false, 700.00),
        (NEW.id, 'Saúde & Farmácia', 'saude', 'heart-pulse', '#ef4444', 'expense', false, 400.00),
        (NEW.id, 'Educação & Cursos', 'educacao', 'graduation-cap', '#14b8a6', 'expense', false, 350.00),
        (NEW.id, 'Compras & Eletrônicos', 'compras', 'shopping-bag', '#a855f7', 'expense', false, 500.00),
        (NEW.id, 'Salário & Remuneração', 'salario', 'briefcase', '#10b981', 'income', false, 0.00),
        (NEW.id, 'Rendimentos & Dividendos', 'rendimentos', 'trending-up', '#059669', 'income', false, 0.00),
        (NEW.id, 'Reserva de Emergência', 'reserva-emergencia', 'shield-check', '#6366f1', 'investment', false, 1000.00),
        (NEW.id, 'Ações & Fundos Imobiliários', 'investimentos-bolsa', 'line-chart', '#047857', 'investment', false, 1500.00)
    ON CONFLICT (user_id, name, type) DO NOTHING;

    -- 3. Cria conta bancária inicial padrão (ex: Conta Principal Nubank e Cartão Nubank)
    INSERT INTO public.accounts_and_cards (user_id, name, type, institution, balance, closing_day, due_day, color, icon)
    VALUES
        (NEW.id, 'Conta Corrente Nubank', 'checking', 'Nubank', 3500.00, NULL, NULL, '#820AD1', 'wallet'),
        (NEW.id, 'Cartão Roxinho Nubank', 'credit_card', 'Nubank', 0.00, 25, 3, '#820AD1', 'credit-card')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    -- Garante que nenhuma inconsistência nos dados padrão impeça o cadastro no auth.users
    RAISE WARNING 'Falha ao inicializar dados automáticos para o usuário %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) - ISOLAMENTO TOTAL POR USUÁRIO
-- ==============================================================================

-- Habilita RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_and_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

-- Função de Verificação de Administrador
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Políticas para PROFILES
CREATE POLICY "Usuários podem visualizar o próprio perfil ou admin visualiza todos"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Usuários podem criar o próprio perfil"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar o próprio perfil ou admin atualiza todos"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin());

-- Políticas para CATEGORIES
CREATE POLICY "Usuários podem visualizar suas categorias"
    ON public.categories FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas categorias"
    ON public.categories FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas categorias"
    ON public.categories FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem remover suas categorias"
    ON public.categories FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para ACCOUNTS_AND_CARDS
CREATE POLICY "Usuários podem visualizar suas contas e cartões"
    ON public.accounts_and_cards FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar contas e cartões"
    ON public.accounts_and_cards FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas contas e cartões"
    ON public.accounts_and_cards FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem remover suas contas e cartões"
    ON public.accounts_and_cards FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para TRANSACTIONS
CREATE POLICY "Usuários podem visualizar suas transações"
    ON public.transactions FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem inserir transações"
    ON public.transactions FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas transações"
    ON public.transactions FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem excluir suas transações"
    ON public.transactions FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para MONTHLY_BUDGETS
CREATE POLICY "Usuários podem visualizar seus orçamentos mensais"
    ON public.monthly_budgets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar ou atualizar seus orçamentos mensais"
    ON public.monthly_budgets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem editar orçamentos mensais"
    ON public.monthly_budgets FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem remover orçamentos mensais"
    ON public.monthly_budgets FOR DELETE
    USING (auth.uid() = user_id);

-- Políticas para FINANCIAL_GOALS
CREATE POLICY "Usuários podem visualizar suas metas financeiras"
    ON public.financial_goals FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar metas financeiras"
    ON public.financial_goals FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas metas financeiras"
    ON public.financial_goals FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem remover metas financeiras"
    ON public.financial_goals FOR DELETE
    USING (auth.uid() = user_id);
