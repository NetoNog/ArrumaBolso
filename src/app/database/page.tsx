'use client';

import React, { useState, useEffect, useRef } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { 
  isSupabaseConfigured, 
  getSupabaseConfig, 
  setSupabaseLocalConfig, 
  clearSupabaseLocalConfig,
  getSupabase
} from '@/lib/supabase/client';
import { FinancialService, MigrationResult } from '@/lib/services/financial-service';
import { AuthModal } from '@/components/auth/auth-modal';
import { FIX_FOREIGN_KEY_SQL } from '@/lib/supabase/sql-scripts';
import { 
  Database, 
  Copy, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  RotateCcw, 
  Key, 
  Cloud, 
  FileJson,
  Upload,
  Download,
  ArrowRight,
  Server,
  Sparkles,
  RefreshCw,
  ExternalLink,
  Trash2,
  Lock,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';

const SAMPLE_SQL_SNIPPET = `-- ==============================================================================
-- ARRUMABOLSO - GESTÃO FINANCEIRA INTELIGENTE & PREVISIBILIDADE
-- SCHEMA DE BANCO DE DADOS (SUPABASE POSTGRESQL + ROW LEVEL SECURITY - RLS)
-- Migração Inicial Completa: profiles, categories, accounts, transactions, budgets, goals
-- ==============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. TABELA: PROFILES
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

-- 2. TABELA: CATEGORIES
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    slug TEXT NOT NULL,
    icon TEXT DEFAULT 'tag',
    color TEXT DEFAULT '#4F46E5',
    type TEXT NOT NULL CHECK (type IN ('expense', 'income', 'investment')),
    is_system BOOLEAN DEFAULT false,
    monthly_budget_cap NUMERIC(12, 2) DEFAULT 0.00,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    UNIQUE(user_id, name, type)
);

-- 3. TABELA: ACCOUNTS_AND_CARDS
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
    color TEXT DEFAULT '#4F46E5',
    icon TEXT DEFAULT 'credit-card',
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. TABELA: TRANSACTIONS (COM PARCELAS, RECORRÊNCIA E HASH NUBANK)
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
    installment_current INTEGER,
    installment_total INTEGER,
    installment_group_id UUID,
    is_recurring BOOLEAN DEFAULT false NOT NULL,
    imported_via_csv BOOLEAN DEFAULT false NOT NULL,
    csv_hash TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. TABELA: MONTHLY_BUDGETS
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

-- 6. TABELA: FINANCIAL_GOALS (Metas & Reserva de Emergência)
CREATE TABLE IF NOT EXISTS public.financial_goals (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    target_amount NUMERIC(12, 2) NOT NULL,
    current_amount NUMERIC(12, 2) DEFAULT 0.00 NOT NULL,
    monthly_contribution NUMERIC(12, 2) DEFAULT 0.00,
    deadline_date DATE,
    icon TEXT DEFAULT 'target',
    color TEXT DEFAULT '#059669',
    is_completed BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 7. ÍNDICES ANALÍTICOS
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON public.transactions (user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_user_hash ON public.transactions (user_id, csv_hash) WHERE csv_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_user_category ON public.transactions (user_id, category_id);

-- 8. POLÍTICAS DE ROW LEVEL SECURITY (RLS) - ISOLAMENTO TOTAL POR USUÁRIO
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts_and_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.monthly_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_goals ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE POLICY "Usuários gerenciam o próprio perfil ou admins gerenciam todos" ON public.profiles
    FOR ALL USING (auth.uid() = id OR public.is_admin());

CREATE POLICY "Permitir inserção de perfil no signup" ON public.profiles
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuários gerenciam suas categorias" ON public.categories
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de categorias no signup" ON public.categories
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuários gerenciam suas contas e cartões" ON public.accounts_and_cards
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Permitir inserção de contas no signup" ON public.accounts_and_cards
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Usuários gerenciam suas transações" ON public.transactions
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Usuários gerenciam seus orçamentos" ON public.monthly_budgets
    FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Usuários gerenciam suas metas" ON public.financial_goals
    FOR ALL USING (auth.uid() = user_id);
`;

export default function DatabasePage() {
  const [copied, setCopied] = useState(false);
  const [sqlTab, setSqlTab] = useState<'fix' | 'full'>('fix');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Status de Configuração do Supabase
  const [supabaseConfig, setSupabaseConfig] = useState<{ url: string; key: string; source: string }>({
    url: '',
    key: '',
    source: 'none'
  });
  const [inputUrl, setInputUrl] = useState('');
  const [inputKey, setInputKey] = useState('');
  const [saveToEnvFile, setSaveToEnvFile] = useState(true);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionTestedOk, setConnectionTestedOk] = useState(false);

  // Status de Autenticação Supabase
  const [supabaseUser, setSupabaseUser] = useState<any>(null);

  // Estado do Processo de Migração
  const [isMigrating, setIsMigrating] = useState(false);
  const [migrationResult, setMigrationResult] = useState<MigrationResult | null>(null);

  const isConfigured = isSupabaseConfigured();

  // Carrega configuração ativa
  const refreshConfigState = async () => {
    const config = getSupabaseConfig();
    setSupabaseConfig(config);
    setInputUrl(config.url || '');
    setInputKey(config.key ? '••••••••••••••••••••••••' : '');

    if (config.url && config.key) {
      const client = getSupabase();
      if (client) {
        try {
          const { data } = await client.auth.getUser();
          setSupabaseUser(data?.user || null);
          setConnectionTestedOk(true);
        } catch {
          setConnectionTestedOk(false);
        }
      }
    } else {
      setSupabaseUser(null);
      setConnectionTestedOk(false);
    }
  };

  useEffect(() => {
    refreshConfigState();
  }, []);

  const handleTestAndSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim() || !inputKey.trim()) {
      toast.error('Informe a URL do Projeto e a Chave Anon.');
      return;
    }

    try {
      setIsTestingConnection(true);
      const res = await fetch('/api/supabase-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: inputUrl.trim(),
          anonKey: inputKey.trim(),
          writeToEnvFile: saveToEnvFile
        })
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || 'Falha ao validar chaves no Supabase.');
      }

      setSupabaseLocalConfig(inputUrl.trim(), inputKey.trim());
      setConnectionTestedOk(true);
      toast.success(
        data.savedToEnv 
          ? 'Conexão Supabase validada e salva no .env.local com sucesso!' 
          : 'Conexão Supabase configurada com sucesso nesta sessão!'
      );
      await refreshConfigState();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao conectar no Supabase.');
      setConnectionTestedOk(false);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleDisconnectSupabase = () => {
    if (confirm('Deseja desconectar as chaves do Supabase? A aplicação voltará ao modo local.')) {
      clearSupabaseLocalConfig();
      setInputUrl('');
      setInputKey('');
      setConnectionTestedOk(false);
      setSupabaseUser(null);
      toast.info('Supabase desconectado.');
      refreshConfigState();
    }
  };

  const handleMigrateAllToSupabase = async () => {
    if (!isConfigured) {
      toast.error('Configure e conecte seu Supabase primeiro antes de migrar.');
      return;
    }

    const client = getSupabase();
    const { data: authData } = await client?.auth.getUser() || { data: null };
    if (!authData?.user) {
      toast.error('Faça login com uma conta no Supabase para associar seus dados!');
      setIsAuthModalOpen(true);
      return;
    }

    const confirmed = confirm(
      'Atenção: Todos os dados locais (contas, categorias, transações, orçamentos e metas) serão transferidos para o Supabase e o banco local será COMPLETAMENTE esvaziado.\n\nDeseja prosseguir com a migração agora?'
    );

    if (!confirmed) return;

    try {
      setIsMigrating(true);
      setMigrationResult(null);

      const result = await FinancialService.migrateAllLocalDataToSupabase();
      setMigrationResult(result);

      if (result.success) {
        toast.success('Migração realizada com sucesso! O banco local foi 100% esvaziado.');
      } else {
        toast.warning('Migração concluída com alguns avisos. Verifique o relatório abaixo.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro durante a migração dos dados.');
    } finally {
      setIsMigrating(false);
    }
  };

  const handleWipeLocalOnly = () => {
    if (confirm('Deseja realmente REMOVER TODAS as informações do banco local (LocalStorage)? Esta ação não pode ser desfeita.')) {
      FinancialService.wipeAllLocalDatabase();
      toast.success('Banco de dados local esvaziado com sucesso!');
      setTimeout(() => window.location.reload(), 800);
    }
  };

  const handleCopy = () => {
    const textToCopy = sqlTab === 'fix' ? FIX_FOREIGN_KEY_SQL : SAMPLE_SQL_SNIPPET;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    toast.success('Script SQL copiado para a área de transferência!');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleExportBackup = () => {
    try {
      const json = FinancialService.exportBackup();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `gestao_financeira_backup_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Backup exportado com sucesso!');
    } catch (err) {
      toast.error('Erro ao gerar arquivo de backup.');
    }
  };

  const MAX_BACKUP_SIZE = 10 * 1024 * 1024; // 10MB

  const handleImportBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.json') && !file.type.includes('json')) {
      toast.error('Selecione um arquivo de backup válido no formato .json');
      e.target.value = '';
      return;
    }

    if (file.size > MAX_BACKUP_SIZE) {
      toast.error('Arquivo muito grande! O limite de backup é de 10MB.');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target?.result as string;
        await FinancialService.importBackup(text);
        toast.success('Backup restaurado com sucesso! Atualizando aplicação...');
        setTimeout(() => window.location.reload(), 1000);
      } catch (err: any) {
        toast.error(err.message || 'Arquivo de backup inválido.');
      } finally {
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    };
    reader.onerror = () => {
      toast.error('Erro ao ler o arquivo de backup.');
      if (fileInputRef.current) fileInputRef.current.value = '';
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground pb-16 md:pb-0">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />

        <main className="p-4 sm:p-8 space-y-6 max-w-5xl mx-auto w-full">
          {/* Header Title */}
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Banco Supabase & Integração
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-0.5">
              Conexão com a nuvem, migração de dados locais e scripts SQL com Row Level Security (RLS).
            </p>
          </div>

          {/* 1. MIGRATION & WIPE HERO BANNER */}
          <div className="p-5 rounded-xl bg-card border border-border/70 shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-secondary/80 text-foreground flex items-center justify-center shrink-0">
                  <Cloud className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm sm:text-base font-bold text-foreground">
                      Sincronizar com o Supabase
                    </h3>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
                    Transfira categorias, contas bancárias, cartões, transações e metas para o banco na nuvem.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <button
                  onClick={handleMigrateAllToSupabase}
                  disabled={isMigrating || !isConfigured}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm transition-all disabled:opacity-50 active:scale-[0.98]"
                >
                  {isMigrating ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      Sincronizando...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      Enviar Dados para Nuvem
                    </>
                  )}
                </button>

                <button
                  onClick={handleWipeLocalOnly}
                  className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive border border-destructive/20 text-xs font-medium transition-colors"
                  title="Remove apenas os dados locais sem migrar"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Esvaziar Local
                </button>
              </div>
            </div>

            {/* Aviso sobre usuário logado no Supabase */}
            {isConfigured && !supabaseUser && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-2 text-amber-700">
                  <AlertTriangle className="w-4 h-4 shrink-0 text-amber-600" />
                  <span>
                    Para que os dados migrados pertençam à sua conta no Supabase sob as políticas de <strong>RLS</strong>, faça login ou cadastre-se no Supabase antes de migrar.
                  </span>
                </div>
                <button
                  onClick={() => setIsAuthModalOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs transition-colors shrink-0"
                >
                  Conectar Conta Supabase
                </button>
              </div>
            )}

            {/* Relatório de Migração Concluída */}
            {migrationResult && (
              <div className="p-4 rounded-xl bg-card border border-border space-y-3 animate-in fade-in-0 duration-200">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                  <h4 className="font-bold text-sm text-foreground">Relatório da Migração</h4>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center text-xs">
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Categorias</span>
                    <strong className="text-sm text-foreground">{migrationResult.categoriesMigrated}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Contas & Cartões</span>
                    <strong className="text-sm text-foreground">{migrationResult.accountsMigrated}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Transações</span>
                    <strong className="text-sm text-foreground">{migrationResult.transactionsMigrated}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Orçamentos</span>
                    <strong className="text-sm text-foreground">{migrationResult.budgetsMigrated}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-secondary/60 border border-border">
                    <span className="text-muted-foreground block text-[11px]">Metas</span>
                    <strong className="text-sm text-foreground">{migrationResult.goalsMigrated}</strong>
                  </div>
                </div>
                {migrationResult.localDataWiped && (
                  <p className="text-xs font-semibold text-emerald-600 flex items-center gap-1.5 pt-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Banco de dados local esvaziado com sucesso! Seus dados agora estão seguros exclusivamente na nuvem Supabase.
                  </p>
                )}
                {migrationResult.errors.length > 0 && (
                  <div className="p-2 rounded bg-rose-500/10 border border-rose-500/20 text-[11px] text-rose-600 space-y-1">
                    <span className="font-bold">Avisos registrados:</span>
                    {migrationResult.errors.map((err, i) => (
                      <div key={i}>• {err}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 2. CONFIGURAÇÃO DE CREDENCIAIS DO SUPABASE */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  isConfigured ? 'bg-emerald-500/10 text-emerald-600' : 'bg-primary/10 text-primary'
                }`}>
                  {isConfigured ? <CheckCircle2 className="w-5 h-5" /> : <Server className="w-5 h-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-sm text-foreground">
                    Configuração de Conexão Supabase
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Origem atual: {
                      supabaseConfig.source === 'env' 
                        ? 'Arquivo .env.local' 
                        : supabaseConfig.source === 'storage' 
                          ? 'Configuração em Sessão / Navegador' 
                          : 'Nenhuma credencial configurada'
                    }
                  </p>
                </div>
              </div>

              {isConfigured && (
                <button
                  onClick={handleDisconnectSupabase}
                  className="text-xs font-semibold text-rose-600 hover:underline"
                >
                  Desconectar
                </button>
              )}
            </div>

            <form onSubmit={handleTestAndSaveConfig} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    URL do Projeto Supabase
                  </label>
                  <input
                    type="url"
                    placeholder="https://seu-projeto.supabase.co"
                    value={inputUrl}
                    onChange={(e) => setInputUrl(e.target.value)}
                    className="w-full bg-secondary text-foreground text-xs px-3.5 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Encontrado em Project Settings &gt; API &gt; Project URL</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1">
                    Chave Anon (Public API Key)
                  </label>
                  <input
                    type="password"
                    placeholder="eyJhbGciOiJIUzI1NiIsInR5c..."
                    value={inputKey}
                    onChange={(e) => setInputKey(e.target.value)}
                    className="w-full bg-secondary text-foreground text-xs px-3.5 py-2.5 rounded-xl border border-border focus:outline-none focus:ring-2 focus:ring-primary/20 font-mono"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground mt-1">Encontrado em Project Settings &gt; API &gt; anon public</p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={saveToEnvFile}
                    onChange={(e) => setSaveToEnvFile(e.target.checked)}
                    className="rounded border-border text-primary focus:ring-primary"
                  />
                  Salvar automaticamente no arquivo <code className="font-mono text-foreground">.env.local</code> do projeto
                </label>

                <div className="flex items-center gap-2">
                  <button
                    type="submit"
                    disabled={isTestingConnection}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold transition-colors disabled:opacity-50"
                  >
                    {isTestingConnection ? (
                      <>
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        Validando...
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        Testar & Salvar Conexão
                      </>
                    )}
                  </button>

                  {isConfigured && (
                    <button
                      type="button"
                      onClick={() => setIsAuthModalOpen(true)}
                      className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-colors"
                    >
                      <Cloud className="w-3.5 h-3.5 text-primary" />
                      {supabaseUser ? `Logado: ${supabaseUser.email}` : 'Fazer Login Supabase'}
                    </button>
                  )}
                </div>
              </div>
            </form>
          </div>

          {/* 3. BACKUP & EXPORTAÇÃO JSON */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <FileJson className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-foreground">Backup & Portabilidade em Arquivo</h3>
                <p className="text-xs text-muted-foreground">Exporte e restaure seus dados a qualquer momento em arquivo JSON padrão.</p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
              <button
                onClick={handleExportBackup}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-all"
              >
                <Download className="w-4 h-4 text-primary" />
                Exportar Backup Completo (.json)
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                className="hidden"
                onChange={handleImportBackup}
              />

              <button
                onClick={() => fileInputRef.current?.click()}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground text-xs font-semibold border border-border transition-all"
              >
                <Upload className="w-4 h-4 text-primary" />
                Restaurar Arquivo de Backup (.json)
              </button>
            </div>
          </div>

          {/* 4. SCRIPTS SQL PARA O SUPABASE */}
          <div className="p-6 rounded-2xl bg-card border border-border shadow-sm space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Database className="w-4 h-4 text-primary" />
                  Scripts SQL para o Supabase
                </h3>
                <p className="text-xs text-muted-foreground">
                  Execute no <strong>SQL Editor</strong> do seu Supabase para ajustar permissões ou criar as tabelas.
                </p>
              </div>

              <div className="flex items-center gap-2">
                {/* Abas entre Fix e Full */}
                <div className="flex items-center bg-secondary/80 p-0.5 rounded-lg border border-border text-xs">
                  <button
                    type="button"
                    onClick={() => setSqlTab('fix')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      sqlTab === 'fix'
                        ? 'bg-card text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Correção RLS &amp; Perfil
                  </button>
                  <button
                    type="button"
                    onClick={() => setSqlTab('full')}
                    className={`px-3 py-1 rounded-md transition-all ${
                      sqlTab === 'full'
                        ? 'bg-card text-foreground font-semibold shadow-xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    Schema Completo DDL
                  </button>
                </div>

                <button
                  onClick={handleCopy}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-semibold shadow-xs transition-all cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copiado!' : 'Copiar Script'}
                </button>
              </div>
            </div>

            <div className="relative rounded-xl border border-border bg-[#18181B] text-zinc-200 overflow-hidden text-[11px] font-mono">
              <div className="px-4 py-2 bg-zinc-900 border-b border-zinc-800 text-zinc-400 flex items-center justify-between">
                <span>{sqlTab === 'fix' ? 'fix_foreign_key_and_profile.sql' : 'supabase_schema_rls_v2.sql'}</span>
                <span>PostgreSQL 15+</span>
              </div>
              <pre className="p-4 max-h-80 overflow-y-auto overflow-x-auto leading-relaxed scrollbar-thin">
                {sqlTab === 'fix' ? FIX_FOREIGN_KEY_SQL : SAMPLE_SQL_SNIPPET}
              </pre>
            </div>
          </div>
        </main>
      </div>

      <AuthModal 
        isOpen={isAuthModalOpen} 
        onClose={() => setIsAuthModalOpen(false)} 
        currentUser={supabaseUser}
        onAuthSuccess={refreshConfigState}
      />
    </div>
  );
}
