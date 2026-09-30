'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  X, 
  Mail, 
  Lock, 
  User, 
  Sparkles, 
  Cloud, 
  LogOut, 
  CheckCircle2, 
  AlertCircle,
  Settings,
  Check,
  Save,
  Palette,
  Calendar,
  DollarSign,
  Link as LinkIcon,
  ExternalLink
} from 'lucide-react';
import { FinancialService } from '@/lib/services/financial-service';
import { isSupabaseConfigured, getSupabase } from '@/lib/supabase/client';
import { useProfile, useUpdateProfile } from '@/hooks/use-financial';
import { usePreferences } from '@/components/providers/privacy-provider';
import { THEME_ACCENTS } from '@/lib/theme/accents';
import { AVATAR_PRESETS } from '@/lib/theme/avatar-presets';
import { UserAvatar } from '@/components/ui/user-avatar';
import { toast } from 'sonner';
import { maskCurrency, parseCurrency, formatNumberToCurrencyInput } from '@/lib/financial/currency-mask';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser?: any;
  onAuthSuccess?: () => void;
}

export function AuthModal({ isOpen, onClose, currentUser, onAuthSuccess }: AuthModalProps) {
  const router = useRouter();
  const { data: profile } = useProfile();
  const updateProfileMutation = useUpdateProfile();
  const { themeAccent, setThemeAccent } = usePreferences();

  // Estados de edição de perfil
  const [fullName, setFullName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [customAvatarUrl, setCustomAvatarUrl] = useState('');
  const [baseIncome, setBaseIncome] = useState('');
  const [salaryDay, setSalaryDay] = useState(5);
  const [isSaving, setIsSaving] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  // Estados de fallback (quando deslogado)
  const [tab, setTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sincroniza dados do perfil sempre que o modal abre
  useEffect(() => {
    if (isOpen) {
      const activeName = profile?.full_name || currentUser?.full_name || '';
      const activeAvatar = profile?.avatar_url || currentUser?.avatar_url || 'preset:piggy';
      const activeIncome = profile?.base_monthly_income !== undefined && profile?.base_monthly_income !== null
        ? formatNumberToCurrencyInput(profile.base_monthly_income)
        : currentUser?.base_monthly_income !== undefined && currentUser?.base_monthly_income !== null
        ? formatNumberToCurrencyInput(currentUser.base_monthly_income)
        : '';
      const activeSalaryDay = profile?.salary_day || 5;

      setFullName(activeName);
      setAvatarUrl(activeAvatar);
      setBaseIncome(activeIncome);
      setSalaryDay(activeSalaryDay);

      if (activeAvatar.startsWith('http') || activeAvatar.startsWith('data:')) {
        setCustomAvatarUrl(activeAvatar);
      } else {
        setCustomAvatarUrl('');
      }
    }
  }, [isOpen, profile, currentUser]);

  if (!isOpen) return null;

  const isConfigured = isSupabaseConfigured();
  const activeUser = currentUser || profile;

  // Salvar Alterações Rápidas do Perfil
  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setIsSaving(true);
      const numericIncome = parseCurrency(baseIncome);

      await updateProfileMutation.mutateAsync({
        full_name: fullName.trim(),
        avatar_url: avatarUrl,
        base_monthly_income: numericIncome,
        salary_day: salaryDay,
        theme_accent: themeAccent,
      });

      toast.success('Perfil atualizado com sucesso!');
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err?.message || 'Erro ao atualizar perfil.');
    } finally {
      setIsSaving(false);
    }
  };

  // Sincronização de dados locais para Supabase
  const handleSyncData = async () => {
    try {
      setIsSyncing(true);
      const res = await FinancialService.migrateAllLocalDataToSupabase();
      if (res.success) {
        toast.success(`Sincronização concluída! ${res.transactionsMigrated} transações e ${res.accountsMigrated} contas salvas no Supabase.`);
      } else {
        toast.warning('Sincronização concluída com avisos.');
      }
      onAuthSuccess?.();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao sincronizar dados com o Supabase.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Logout
  const handleSignOut = async () => {
    try {
      await FinancialService.signOut();
      toast.success('Sessão encerrada com sucesso.');
      onAuthSuccess?.();
      onClose();
      router.push('/login');
    } catch (err: any) {
      toast.error('Erro ao sair da conta.');
    }
  };

  // Login/Signup de Fallback (apenas se deslogado)
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConfigured) {
      toast.error('Supabase ainda não configurado no .env.local.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (tab === 'login') {
        const { error } = await FinancialService.signInWithEmail(email, password);
        if (error) throw error;
        toast.success('Login realizado com sucesso!');
      } else {
        const { error } = await FinancialService.signUpWithEmail(email, password, fullName);
        if (error) throw error;
        toast.success('Cadastro realizado com sucesso!');
      }
      onAuthSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(err.message || 'Erro durante autenticação.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-card border border-border/80 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-3.5 border-b border-border/70 flex items-center justify-between shrink-0 bg-secondary/20">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              {activeUser ? 'Meu Perfil & Personalização' : 'Conectar Conta no Supabase'}
            </h3>
          </div>
          <button 
            onClick={onClose} 
            className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {activeUser ? (
            <form onSubmit={handleSaveProfile} className="space-y-4">
              {/* Preview do Avatar & Status */}
              <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-secondary/30 border border-border/60">
                <UserAvatar 
                  avatarUrl={avatarUrl}
                  name={fullName}
                  email={activeUser.email}
                  size="lg"
                  className="ring-2 ring-primary/30 shrink-0 shadow-sm"
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold text-sm text-foreground truncate">
                      {fullName || activeUser.full_name || 'Usuário'}
                    </span>
                    {activeUser.role === 'admin' ? (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                        ADMIN
                      </span>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{activeUser.email}</p>
                  <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1 mt-0.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    Sessão ativa no Supabase
                  </span>
                </div>
              </div>

              {/* Seletor Rápido de Avatar */}
              <div className="space-y-2">
                <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Escolha seu Avatar</span>
                  <span className="text-[10px] text-muted-foreground font-normal">Presets & Iniciais</span>
                </label>
                <div className="grid grid-cols-5 gap-2">
                  {AVATAR_PRESETS.map((preset) => {
                    const isSelected = avatarUrl === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setAvatarUrl(preset.id);
                          setCustomAvatarUrl('');
                        }}
                        className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-primary/10 border-primary ring-2 ring-primary/40 shadow-xs'
                            : 'bg-secondary/40 border-border/70 hover:bg-secondary/70'
                        }`}
                        title={preset.name}
                      >
                        <UserAvatar 
                          avatarUrl={preset.id}
                          name={fullName}
                          size="sm"
                        />
                        <span className="text-[9px] text-muted-foreground truncate max-w-full text-center leading-tight">
                          {preset.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Input de URL Personalizada */}
                <div className="pt-1">
                  <div className="relative">
                    <LinkIcon className="w-3.5 h-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="url"
                      value={customAvatarUrl}
                      onChange={(e) => {
                        setCustomAvatarUrl(e.target.value);
                        if (e.target.value.trim()) {
                          setAvatarUrl(e.target.value.trim());
                        }
                      }}
                      placeholder="Ou cole o link de uma foto sua (URL)"
                      className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-secondary/40 border border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Seletor Rápido de Cor de Destaque (Tema) */}
              <div className="space-y-2 pt-1 border-t border-border/50">
                <label className="text-xs font-semibold text-foreground block">
                  Cor de Destaque do Sistema (Tema)
                </label>
                <div className="grid grid-cols-6 gap-1.5">
                  {THEME_ACCENTS.map((accent) => {
                    const isSelected = themeAccent === accent.id;
                    return (
                      <button
                        key={accent.id}
                        type="button"
                        onClick={() => {
                          setThemeAccent(accent.id);
                          toast.success(`Tema ${accent.name} ativado!`);
                        }}
                        className={`p-1.5 rounded-xl border flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'bg-secondary border-primary ring-2 ring-primary/40 shadow-xs'
                            : 'bg-secondary/40 border-border/70 hover:bg-secondary/70'
                        }`}
                        title={accent.name}
                      >
                        <div 
                          className="w-3.5 h-3.5 rounded-full shadow-xs"
                          style={{ backgroundColor: accent.hex }}
                        />
                        <span className="text-[9px] font-bold text-foreground truncate max-w-full">
                          {accent.name.split(' ')[0]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Campos do Perfil */}
              <div className="space-y-3 pt-1 border-t border-border/50">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-foreground">Nome Completo</label>
                  <input
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Seu nome completo"
                    className="w-full px-3 py-2 text-xs rounded-xl bg-secondary/40 border border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Renda Base (R$)</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">R$</span>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={baseIncome}
                        onChange={(e) => setBaseIncome((prev) => maskCurrency(e.target.value, prev))}
                        placeholder="0,00"
                        className="w-full pl-9 pr-3 py-2 text-xs font-bold rounded-xl bg-secondary/40 border border-border/80 text-foreground placeholder:text-muted-foreground/50 focus:border-primary focus:outline-none font-mono tabular-nums"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-foreground">Dia do Ciclo</label>
                    <select
                      value={salaryDay}
                      onChange={(e) => setSalaryDay(parseInt(e.target.value, 10))}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-secondary/40 border border-border/80 text-foreground focus:border-primary focus:outline-none cursor-pointer"
                    >
                      {[1, 5, 10, 15, 20, 25, 28].map(day => (
                        <option key={day} value={day} className="bg-card text-foreground">
                          Dia {day} de cada mês
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Botão de Salvar Alterações */}
              <button
                type="submit"
                disabled={isSaving}
                className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                {isSaving ? 'Salvando...' : 'Salvar Alterações do Perfil'}
              </button>

              {/* Ações Secundárias */}
              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push('/settings');
                  }}
                  className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5" />
                  <span>Configurações Completas</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSyncData}
                    disabled={isSyncing}
                    className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer disabled:opacity-50"
                    title="Sincronizar dados locais com o Supabase"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>{isSyncing ? 'Sincronizando...' : 'Nuvem'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="inline-flex items-center gap-1 text-[11px] text-destructive hover:underline transition-colors cursor-pointer font-medium ml-1"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sair da Conta</span>
                  </button>
                </div>
              </div>
            </form>
          ) : (
            /* Fallback quando não há usuário logado */
            <div className="space-y-4">
              {!isConfigured && (
                <div className="p-3 rounded-lg bg-secondary/40 border border-border/80 text-xs text-muted-foreground flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                  <span>Chaves do Supabase não configuradas no cliente.</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-1 p-0.5 bg-secondary/60 rounded-lg border border-border/70 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => setTab('login')}
                  className={`py-1.5 rounded-md transition-all ${tab === 'login' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Entrar
                </button>
                <button
                  type="button"
                  onClick={() => setTab('signup')}
                  className={`py-1.5 rounded-md transition-all ${tab === 'signup' ? 'bg-card text-foreground font-semibold shadow-xs' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  Criar Conta
                </button>
              </div>

              <form onSubmit={handleAuth} className="space-y-3">
                {tab === 'signup' && (
                  <div>
                    <label className="text-xs font-medium text-muted-foreground block mb-1">Nome Completo</label>
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Seu nome"
                      className="w-full px-3 py-2 rounded-xl bg-secondary/40 border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                    />
                  </div>
                )}

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Email</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="nome@email.com"
                    className="w-full px-3 py-2 rounded-xl bg-secondary/40 border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <div>
                  <label className="text-xs font-medium text-muted-foreground block mb-1">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 rounded-xl bg-secondary/40 border border-border text-xs text-foreground focus:outline-none focus:border-primary"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-semibold text-xs transition-all disabled:opacity-50 cursor-pointer"
                >
                  {isSubmitting ? 'Processando...' : tab === 'login' ? 'Entrar' : 'Criar Conta'}
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
