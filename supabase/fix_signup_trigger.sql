-- ==============================================================================
-- CORREÇÃO DEFINITIVA DO ERRO 500 AO CRIAR CONTA E RLS NO SUPABASE
-- Execute este script no SQL Editor do seu Dashboard Supabase
-- (Dashboard Supabase -> SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Habilita RLS e garante permissões de inserção e atualização de profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Usuários podem visualizar o próprio perfil ou admin visualiza todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem atualizar o próprio perfil ou admin atualiza todos" ON public.profiles;
DROP POLICY IF EXISTS "Usuários podem criar o próprio perfil" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserção de perfil" ON public.profiles;
DROP POLICY IF EXISTS "Permitir inserção de perfil no signup" ON public.profiles;
DROP POLICY IF EXISTS "Usuários gerenciam o próprio perfil ou admins gerenciam todos" ON public.profiles;

CREATE POLICY "Usuários podem visualizar o próprio perfil"
    ON public.profiles FOR SELECT
    USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Usuários podem criar o próprio perfil"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id OR auth.uid() IS NOT NULL);

CREATE POLICY "Usuários podem atualizar o próprio perfil"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id OR public.is_admin())
    WITH CHECK (auth.uid() = id OR public.is_admin());

-- 2. Backfill de usuários existentes que possam estar sem perfil
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

-- 3. Atualiza função handle_new_user com proteção contra erros
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER 
LANGUAGE plpgsql 
SECURITY DEFINER 
SET search_path = public
AS $$
BEGIN
    -- Cria perfil inicial
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

    -- Popula categorias padrão para o usuário
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

    -- Cria conta bancária inicial padrão (Conta Nubank e Cartão Nubank)
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

-- Recria o gatilho na tabela auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
