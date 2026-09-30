'use client';

import React, { useState, useEffect } from 'react';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { FinancialService } from '@/lib/services/financial-service';
import { useProfile, useUpdateProfile, useAccounts, useTransactions, useCategories } from '@/hooks/use-financial';
import { usePreferences } from '@/components/providers/privacy-provider';
import { THEME_ACCENTS, applyThemeAccent } from '@/lib/theme/accents';
import { AVATAR_PRESETS } from '@/lib/theme/avatar-presets';
import { UserAvatar } from '@/components/ui/user-avatar';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';
import { 
  Settings, 
  User, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  Lock, 
  Eye, 
  EyeOff, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Save, 
  Sparkles, 
  KeyRound,
  Palette,
  Check,
  Percent,
  SlidersHorizontal,
  Link as LinkIcon
} from 'lucide-react';
import { toast } from 'sonner';

export default function SettingsPage() {
  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const { data: accounts = [] } = useAccounts();
  const { data: transactions = [] } = useTransactions();
  const { data: categories = [] } = useCategories();

  // Preferências globais do sistema
  const { 
    isPrivacyMode, 
    togglePrivacyMode,
    defaultPrivacy,
    setDefaultPrivacy,
    hideCents,
    setHideCents,
    themeAccent,
    setThemeAccent,
    spendingAlertThreshold,
    setSpendingAlertThreshold
  } = usePreferences();

  // Estados de formulário de perfil
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatarInput, setCustomAvatarInput] = useState('');
  const [baseIncome, setBaseIncome] = useState('');
  const [salaryDay, setSalaryDay] = useState(5);
  const [currency, setCurrency] = useState('BRL');
  const [isSavingProfile, setIsSavingProfile] = useState(false);

  // Estados de troca de senha
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Carrega dados iniciais do profile
  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || '');
      setAvatarUrl(profile.avatar_url || 'preset:piggy');
      if (profile.avatar_url && (profile.avatar_url.startsWith('http') || profile.avatar_url.startsWith('data:'))) {
        setCustomAvatarInput(profile.avatar_url);
      }
      setBaseIncome(profile.base_monthly_income ? formatNumberToCurrencyInput(profile.base_monthly_income) : '');
      setSalaryDay(profile.salary_day || 5);
      setCurrency(profile.currency || 'BRL');
      
      if (profile.theme_accent) {
        setThemeAccent(profile.theme_accent);
      }
      if (profile.default_privacy_mode !== undefined) {
        setDefaultPrivacy(profile.default_privacy_mode);
      }
      if (profile.hide_cents !== undefined) {
        setHideCents(profile.hide_cents);
      }
      if (profile.spending_alert_threshold) {
        setSpendingAlertThreshold(profile.spending_alert_threshold);
      }
    }
  }, [profile, setThemeAccent, setDefaultPrivacy, setHideCents, setSpendingAlertThreshold]);

  // Força de senha
  const getPasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: '', color: 'bg-muted' };
    let score = 0;
    if (pass.length >= 6) score += 1;
    if (pass.length >= 8) score += 1;
    if (/[A-Z]/.test(pass) && /[0-9]/.test(pass)) score += 1;
    if (/[^A-Za-z0-9]/.test(pass)) score += 1;

    if (score <= 1) return { score: 1, label: 'Fraca', color: 'bg-rose-500' };
    if (score <= 2) return { score: 2, label: 'Razoável', color: 'bg-amber-500' };
    if (score <= 3) return { score: 3, label: 'Boa', color: 'bg-primary' };
    return { score: 4, label: 'Forte', color: 'bg-emerald-500' };
  };

  const passwordStrength = getPasswordStrength(newPassword);

  // Salva Perfil e Preferências
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingProfile(true);
    try {
      const numericIncome = parseCurrency(baseIncome);

      await updateProfileMutation.mutateAsync({
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
        base_monthly_income: numericIncome,
        salary_day: salaryDay,
        currency: currency,
        theme_accent: themeAccent,
        default_privacy_mode: defaultPrivacy,
        hide_cents: hideCents,
        spending_alert_threshold: spendingAlertThreshold,
      });

      toast.success('Perfil e personalizações atualizados com sucesso!');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao salvar preferências.');
    } finally {
      setIsSavingProfile(false);
    }
  };

  // Alteração de Senha Segura
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    setIsChangingPassword(true);
    try {
      const { error } = await FinancialService.updateUserPassword(newPassword);
      if (error) throw new Error(error.message);

      toast.success('Senha atualizada com sucesso!');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err?.message || 'Falha ao atualizar senha.');
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Exportar Backup Completo (LGPD)
  const handleExportAllData = () => {
    try {
      const backupData = {
        exportDate: new Date().toISOString(),
        appName: 'ArrumaBolso',
        profile,
        accounts,
        categories,
        transactions,
        totalTransactions: transactions.length,
        totalAccounts: accounts.length
      };

      const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(backupData, null, 2));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute('href', dataStr);
      downloadAnchor.setAttribute('download', `arrumabolso_backup_${new Date().toISOString().split('T')[0]}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();

      toast.success('Backup completo gerado com sucesso!');
    } catch (err: any) {
      toast.error('Falha ao exportar dados.');
    }
  };

  const currentAccent = THEME_ACCENTS.find(a => a.id === themeAccent) || THEME_ACCENTS[0];

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <AppSidebar accounts={accounts} />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />

        <main className="p-4 sm:p-8 space-y-6 max-w-4xl mx-auto w-full pb-28 md:pb-12">
          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <Settings className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                Configurações & Personalização
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground">
                Personalize sua identidade visual, tema de cores, dados pessoais e privacidade.
              </p>
            </div>
          </div>

          {/* Profile Hero Card */}
          <div className="p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-card to-secondary/30 border border-border/80 shadow-sm flex flex-col sm:flex-row items-center sm:items-start gap-5">
            <UserAvatar 
              avatarUrl={avatarUrl}
              name={fullName || profile?.full_name}
              email={profile?.email}
              size="xl"
              className="ring-4 ring-primary/20 shrink-0 shadow-md"
            />

            <div className="flex-1 text-center sm:text-left space-y-1.5 min-w-0">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h2 className="text-lg font-bold text-foreground truncate">
                  {fullName || profile?.full_name || 'Usuário ArrumaBolso'}
                </h2>
                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                  {profile?.role === 'admin' ? 'Administrador' : 'Conta Pessoal'}
                </span>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Ativo no Supabase
                </span>
              </div>
              <p className="text-xs text-muted-foreground truncate">
                {profile?.email || 'email@arrumabolso.com'}
              </p>
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 pt-1 text-[11px] text-muted-foreground">
                <span>Tema: <strong className="text-foreground">{currentAccent.name}</strong></span>
                <span>Ciclo: <strong className="text-foreground">Dia {salaryDay}</strong></span>
                <span>Centavos: <strong className="text-foreground">{hideCents ? 'Ocultos' : 'Visíveis'}</strong></span>
              </div>
            </div>
          </div>

          <form onSubmit={handleSaveProfile} className="space-y-6">
            {/* 1. SEÇÃO: IDENTIDADE VISUAL & AVATAR */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <Palette className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Identidade Visual & Avatar</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Escolha o avatar temático que representa seu estilo financeiro ou insira uma foto própria.
                  </p>
                </div>
              </div>

              {/* Seletor de Presets de Avatar */}
              <div className="space-y-3">
                <label className="text-xs font-semibold text-foreground block">
                  Escolha um Avatar Pré-definido
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatarUrl === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(preset.id);
                          setCustomAvatarInput('');
                        }}
                        className={`flex items-center gap-2 p-2 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary shadow-xs ring-1 ring-primary/40'
                            : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border text-muted-foreground'
                        }`}
                      >
                        <UserAvatar 
                          avatarUrl={preset.id}
                          name={fullName}
                          size="sm"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-medium block truncate text-foreground">
                            {preset.name}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-3.5 h-3.5 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Ou URL personalizada */}
              <div className="space-y-2 pt-2 border-t border-border/50">
                <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <span>Ou use a URL de uma foto própria (Gravatar, Google, GitHub, etc.)</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="url"
                    value={customAvatarInput}
                    onChange={(e) => {
                      setCustomAvatarInput(e.target.value);
                      if (e.target.value.trim()) {
                        setAvatarUrl(e.target.value.trim());
                      }
                    }}
                    placeholder="https://exemplo.com/sua-foto.jpg"
                    className="flex-1 bg-secondary/50 text-foreground text-xs px-3.5 py-2 rounded-xl border border-border/80 focus:border-primary focus:outline-none"
                  />
                  {customAvatarInput && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomAvatarInput('');
                        setAvatarUrl('preset:piggy');
                      }}
                      className="px-3 py-2 text-xs rounded-xl bg-secondary text-muted-foreground hover:text-foreground"
                    >
                      Limpar
                    </button>
                  )}
                </div>
              </div>

              {/* Seletor de Cor de Destaque (Accent Theme) */}
              <div className="space-y-3 pt-3 border-t border-border/50">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-foreground block">
                    Cor de Destaque da Interface (Accent Color)
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    Altera botões, anéis de foco e elementos em tempo real
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                  {THEME_ACCENTS.map((accent) => {
                    const isSelected = themeAccent === accent.id;
                    return (
                      <button
                        key={accent.id}
                        type="button"
                        onClick={() => {
                          setThemeAccent(accent.id);
                          toast.success(`Tema ${accent.name} aplicado!`);
                        }}
                        className={`flex items-center gap-2 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-secondary border-primary ring-2 ring-primary/40 shadow-sm'
                            : 'bg-secondary/40 border-border/70 hover:bg-secondary/70 hover:border-border'
                        }`}
                      >
                        <div 
                          className="w-4 h-4 rounded-full shrink-0 shadow-sm"
                          style={{ backgroundColor: accent.hex }}
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-[11px] font-bold block truncate text-foreground">
                            {accent.name.split(' ')[0]}
                          </span>
                        </div>
                        {isSelected && (
                          <Check className="w-3 h-3 text-primary shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 2. SEÇÃO: PREFERÊNCIAS DE EXIBIÇÃO & PRIVACIDADE */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <SlidersHorizontal className="w-4 h-4 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Exibição & Modo Privacidade</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Ajuste o comportamento visual de números, sigilo de valores e alertas de despesas.
                  </p>
                </div>
              </div>

              <div className="space-y-4">
                {/* Toggle: Iniciar com Olho Mágico ativo */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/60">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Eye className="w-3.5 h-3.5 text-emerald-400" />
                      <span className="text-xs font-semibold text-foreground">
                        Iniciar Sempre com Valores Ocultos (Olho Mágico)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      O sistema abre automaticamente com valores borrados para segurança em locais públicos. Pressione <strong>P</strong> a qualquer momento para revelar.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !defaultPrivacy;
                      setDefaultPrivacy(next);
                      toast.info(next ? 'Olho Mágico será ativado automaticamente ao iniciar.' : 'Início com valores visíveis por padrão.');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      defaultPrivacy
                        ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                        : 'bg-secondary text-muted-foreground border border-border'
                    }`}
                  >
                    {defaultPrivacy ? 'Ativado por Padrão' : 'Desativado'}
                  </button>
                </div>

                {/* Toggle: Ocultar Centavos */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/60">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">
                        Ocultar Centavos nos Resumos e Cartões (Visão Limpa)
                      </span>
                    </div>
                    <p className="text-[11px] text-muted-foreground">
                      Exibe valores arredondados nos cartões de KPI e gráficos (ex: <strong>R$ 4.250</strong> em vez de R$ 4.250,00), mantendo centavos no extrato analítico.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      const next = !hideCents;
                      setHideCents(next);
                      toast.info(next ? 'Centavos ocultos nos resumos!' : 'Centavos visíveis em todos os valores.');
                    }}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                      hideCents
                        ? 'bg-primary/20 text-primary border border-primary/30'
                        : 'bg-secondary text-muted-foreground border border-border'
                    }`}
                  >
                    {hideCents ? 'Visão Limpa (Sem Centavos)' : 'Exibir Centavos'}
                  </button>
                </div>

                {/* Alerta de Teto de Gastos (% da Renda) */}
                <div className="p-3.5 rounded-xl bg-secondary/30 border border-border/60 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Percent className="w-3.5 h-3.5 text-amber-400" />
                      <span className="text-xs font-semibold text-foreground">
                        Alerta de Teto de Gastos do Mês
                      </span>
                    </div>
                    <span className="text-xs font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                      {spendingAlertThreshold}% da Renda
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Exibe um aviso visual no painel quando o total de despesas do mês ultrapassar este limite em relação à sua renda mensal estimada.
                  </p>
                  <div className="grid grid-cols-5 gap-1.5 pt-1">
                    {[60, 70, 80, 85, 90].map((perc) => (
                      <button
                        key={perc}
                        type="button"
                        onClick={() => setSpendingAlertThreshold(perc)}
                        className={`py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                          spendingAlertThreshold === perc
                            ? 'bg-amber-500 text-black font-bold shadow-xs'
                            : 'bg-secondary/60 text-muted-foreground hover:text-foreground border border-border'
                        }`}
                      >
                        {perc}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* 3. SEÇÃO: DADOS PESSOAIS & CICLO DE RENDA */}
            <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-border/60 pb-3">
                <User className="w-4 h-4 text-primary" />
                <div>
                  <h3 className="font-bold text-sm text-foreground">Dados Pessoais & Ciclo Financeiro</h3>
                  <p className="text-[11px] text-muted-foreground">
                    Configure seu ciclo de pagamento e renda base para cálculo dos indicadores de saúde.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Nome Completo
                  </label>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome"
                    className="w-full bg-secondary/50 text-foreground text-sm px-3.5 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none transition-colors"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    E-mail da Conta (Supabase Auth)
                  </label>
                  <input
                    type="email"
                    value={profile?.email || ''}
                    disabled
                    className="w-full bg-secondary/20 text-muted-foreground text-sm px-3.5 py-2.5 rounded-xl border border-border/50 cursor-not-allowed"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Renda Mensal Base Estimada (R$)
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-2.5 text-xs font-bold text-muted-foreground">R$</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={baseIncome}
                      onChange={(e) => setBaseIncome((prev) => maskCurrency(e.target.value, prev))}
                      placeholder="0,00"
                      className="w-full bg-secondary/50 text-foreground text-sm font-bold pl-10 pr-3.5 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none transition-colors font-mono tabular-nums"
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Utilizado no Score de Saúde e no comparativo de teto de gastos.
                  </span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Dia de Início do Ciclo Financeiro
                  </label>
                  <select
                    value={salaryDay}
                    onChange={(e) => setSalaryDay(parseInt(e.target.value, 10))}
                    className="w-full bg-secondary/50 text-foreground text-sm px-3.5 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none cursor-pointer"
                  >
                    {[1, 5, 10, 15, 20, 25, 28].map(day => (
                      <option key={day} value={day} className="bg-card text-foreground">
                        Dia {day} de cada mês (Ciclo dia {day} ao dia {day})
                      </option>
                    ))}
                  </select>
                  <span className="text-[10px] text-muted-foreground mt-1 block">
                    Dia em que você costuma receber sua remuneração principal.
                  </span>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isSavingProfile}
                  className="inline-flex items-center gap-2 px-6 py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <Save className="w-4 h-4" />
                  {isSavingProfile ? 'Salvando...' : 'Salvar Todas as Preferências'}
                </button>
              </div>
            </div>
          </form>

          {/* 4. SEÇÃO: SEGURANÇA DA CONTA (TROCA DE SENHA) */}
          <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-5">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Lock className="w-4 h-4 text-amber-400" />
              <div>
                <h3 className="font-bold text-sm text-foreground">Segurança & Alteração de Senha</h3>
                <p className="text-[11px] text-muted-foreground">
                  Atualize sua senha de acesso ao Supabase para manter suas finanças protegidas.
                </p>
              </div>
            </div>

            <form onSubmit={handleChangePassword} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Nova Senha
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Mínimo de 6 caracteres"
                    className="w-full bg-secondary/50 text-foreground text-sm px-3.5 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-foreground block mb-1.5">
                    Confirmar Nova Senha
                  </label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full bg-secondary/50 text-foreground text-sm px-3.5 py-2.5 rounded-xl border border-border/80 focus:border-primary focus:outline-none"
                  />
                </div>
              </div>

              {newPassword && (
                <div className="flex items-center gap-2 pt-0.5">
                  <div className="grid grid-cols-4 gap-1 flex-1 h-1.5">
                    {[1, 2, 3, 4].map((step) => (
                      <div
                        key={step}
                        className={`rounded-full transition-colors ${
                          passwordStrength.score >= step ? passwordStrength.color : 'bg-secondary'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-[11px] text-muted-foreground font-medium">
                    {passwordStrength.label}
                  </span>
                </div>
              )}

              <div className="pt-2 flex justify-end">
                <button
                  type="submit"
                  disabled={isChangingPassword || !newPassword}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold text-xs shadow-sm transition-all active:scale-95 disabled:opacity-50 cursor-pointer"
                >
                  <KeyRound className="w-4 h-4" />
                  {isChangingPassword ? 'Atualizando...' : 'Atualizar Senha'}
                </button>
              </div>
            </form>
          </div>

          {/* 5. SEÇÃO: PORTABILIDADE E BACKUP (LGPD) */}
          <div className="p-6 rounded-2xl bg-card border border-border/80 shadow-sm space-y-4">
            <div className="flex items-center gap-2 border-b border-border/60 pb-3">
              <Download className="w-4 h-4 text-cyan-400" />
              <div>
                <h3 className="font-bold text-sm text-foreground">Portabilidade de Dados (Backup Completo)</h3>
                <p className="text-[11px] text-muted-foreground">
                  Baixe todos os seus registros financeiros em formato padronizado JSON para backup offline.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-secondary/30 border border-border/60">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-foreground block">
                  Exportar todas as contas, categorias, metas e transações
                </span>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Gera um arquivo seguro contendo {transactions.length} transações e {accounts.length} contas cadastradas.
                </p>
              </div>

              <button
                type="button"
                onClick={handleExportAllData}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 border border-cyan-500/30 text-xs font-bold transition-all shrink-0 active:scale-95 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Baixar Backup (.json)
              </button>
            </div>
          </div>
        </main>
      </div>

      <MobileBottomNav />
    </div>
  );
}
