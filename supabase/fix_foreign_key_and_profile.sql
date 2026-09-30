-- ==============================================================================
-- CORREÇÃO DEFINITIVA: PERMISSÕES (RLS) E FOREIGN KEY NO SUPABASE
-- Execute este script no SQL Editor do seu Supabase Dashboard:
-- (Supabase Dashboard -> SQL Editor -> New Query -> Colar e clicar em 'Run')
-- ==============================================================================

-- 1. Habilitar extensões
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. POLÍTICAS DE RLS NA TABELA PROFILES (INCLUINDO INSERT E UPSERT)
-- ==============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Remove políticas antigas que possam causar conflito
DROP POLICY IF EXISTS "Usuários podem visualizar o próprio perfil ou admin visualiza todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil ou admin atualiza todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem criar o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserção de perfil" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserção de perfil no signup" ON public.profiles;
DROP POLICY IF EXISTS "Usuários gerenciam o próprio perfil ou admins gerenciam todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem gerenciar seu próprio perfil" ON public.profiles;

-- Política de Leitura: Próprio usuário ou admin
CREATE POLICY "Usuários podem visualizar o próprio perfil"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

-- Política de Inserção: Usuário autenticado ou signup
CREATE POLICY "Usuários podem criar o próprio perfil"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NOT NULL);

-- Política de Atualização: Próprio usuário ou admin
CREATE POLICY "Usuários podem atualizar o próprio perfil"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- ==============================================================================
-- 3. POLÍTICAS DE RLS PARA DEMAIS TABELAS
-- ==============================================================================
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_and_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

-- CATEGORIES
DROP POLICY IF EXISTS "Usuários gerenciam suas categorias" ON public.categories;
DROP POLICY IF EXISTS "Usuários podem visualizar suas categorias" ON public.categories;
DROP POLICY IF EXISTS "Usuários podem criar suas categorias" ON public.categories;
DROP POLICY IF EXISTS "Usuários podem atualizar suas categorias" ON public.categories;
DROP POLICY IF EXISTS "Usuários podem remover suas categorias" ON public.categories;
DROP POLICY IF EXISTS "Permitir inserção de categorias no signup" ON public.categories;

CREATE POLICY "Usuários gerenciam suas categorias" 
    ON public.categories FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- ACCOUNTS_AND_CARDS
DROP POLICY IF EXISTS "Usuários gerenciam suas contas e cartões" ON public.accounts_and_cards;
DROP POLICY IF EXISTS "Usuários podem visualizar suas contas e cartões" ON public.accounts_and_cards;
DROP POLICY IF EXISTS "Usuários podem criar contas e cartões" ON public.accounts_and_cards;
DROP POLICY IF EXISTS "Usuários podem atualizar suas contas e cartões" ON public.accounts_and_cards;
DROP POLICY IF EXISTS "Usuários podem remover suas contas e cartões" ON public.accounts_and_cards;
DROP POLICY IF EXISTS "Permitir inserção de contas no signup" ON public.accounts_and_cards;

CREATE POLICY "Usuários gerenciam suas contas e cartões" 
    ON public.accounts_and_cards FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- TRANSACTIONS
DROP POLICY IF EXISTS "Usuários gerenciam suas transações" ON public.transactions;
DROP POLICY IF EXISTS "Usuários podem visualizar suas transações" ON public.transactions;
DROP POLICY IF EXISTS "Usuários podem inserir transações" ON public.transactions;
DROP POLICY IF EXISTS "Usuários podem criar suas transações" ON public.transactions;
DROP POLICY IF EXISTS "Usuários podem atualizar suas transações" ON public.transactions;
DROP POLICY IF EXISTS "Usuários podem excluir suas transações" ON public.transactions;
DROP POLICY IF EXISTS "Usuários podem remover suas transações" ON public.transactions;

CREATE POLICY "Usuários gerenciam suas transações" 
    ON public.transactions FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- MONTHLY_BUDGETS
DROP POLICY IF EXISTS "Usuários gerenciam seus orçamentos" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Usuários podem visualizar seus orçamentos mensais" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Usuários podem criar ou atualizar seus orçamentos mensais" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Usuários podem editar orçamentos mensais" ON public.monthly_budgets;
DROP POLICY IF EXISTS "Usuários podem remover orçamentos mensais" ON public.monthly_budgets;

CREATE POLICY "Usuários gerenciam seus orçamentos" 
    ON public.monthly_budgets FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- FINANCIAL_GOALS
DROP POLICY IF EXISTS "Usuários gerenciam suas metas" ON public.financial_goals;
DROP POLICY IF EXISTS "Usuários podem visualizar suas metas financeiras" ON public.financial_goals;
DROP POLICY IF EXISTS "Usuários podem criar metas financeiras" ON public.financial_goals;
DROP POLICY IF EXISTS "Usuários podem atualizar suas metas financeiras" ON public.financial_goals;
DROP POLICY IF EXISTS "Usuários podem remover metas financeiras" ON public.financial_goals;

CREATE POLICY "Usuários gerenciam suas metas" 
    ON public.financial_goals FOR ALL 
    USING (auth.uid() = user_id) 
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 4. BACKFILL: POPULAR PROFILES PARA TODOS OS USUÁRIOS EXISTENTES DE AUTH.USERS
-- ==============================================================================
INSERT INTO public.profiles (id, email, full_name, role, status)
SELECT 
    id, 
    COALESCE(email, ''), 
    COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1), 'Usuário'),
    'user',
    'active'
FROM auth.users
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name);

-- ==============================================================================
-- 5. BACKFILL: GARANTIR CONTAS E CARTÃO NUBANK PARA USUÁRIOS EXISTENTES
-- ==============================================================================
INSERT INTO public.accounts_and_cards (user_id, name, type, institution, balance, closing_day, due_day, color, icon)
SELECT 
    u.id, 
    'Cartão Roxinho Nubank', 
    'credit_card', 
    'Nubank', 
    0.00, 
    25, 
    3, 
    '#820AD1', 
    'credit-card'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts_and_cards a 
    WHERE a.user_id = u.id AND a.type = 'credit_card'
);

INSERT INTO public.accounts_and_cards (user_id, name, type, institution, balance, closing_day, due_day, color, icon)
SELECT 
    u.id, 
    'Conta Corrente Nubank', 
    'checking', 
    'Nubank', 
    3500.00, 
    NULL, 
    NULL, 
    '#820AD1', 
    'wallet'
FROM auth.users u
WHERE NOT EXISTS (
    SELECT 1 FROM public.accounts_and_cards a 
    WHERE a.user_id = u.id AND a.type = 'checking'
);

-- ==============================================================================
-- 6. ATUALIZAR TRIGGER DE AUTO-CRIAÇÃO PARA NOVOS USUÁRIOS
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- 1. Cria perfil inicial
    INSERT INTO public.profiles (id, email, full_name, avatar_url, role, status)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1), 'Usuário'),
        NEW.raw_user_meta_data->>'avatar_url',
        'user',
        'active'
    )
    ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
        full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name);

    -- 2. Popula categorias padrão
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

    -- 3. Cria contas padrão Nubank
    INSERT INTO public.accounts_and_cards (user_id, name, type, institution, balance, closing_day, due_day, color, icon)
    VALUES
        (NEW.id, 'Conta Corrente Nubank', 'checking', 'Nubank', 3500.00, NULL, NULL, '#820AD1', 'wallet'),
        (NEW.id, 'Cartão Roxinho Nubank', 'credit_card', 'Nubank', 0.00, 25, 3, '#820AD1', 'credit-card')
    ON CONFLICT DO NOTHING;

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'Aviso no trigger handle_new_user para %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
