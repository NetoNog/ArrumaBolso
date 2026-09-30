'use client';

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  Mail, 
  Lock, 
  User, 
  ArrowRight, 
  CheckCircle2, 
  Eye, 
  EyeOff, 
  KeyRound,
  X,
  Sparkles,
  TrendingUp,
  Wallet,
  Coffee,
  Check
} from 'lucide-react';
import { FinancialService } from '@/lib/services/financial-service';
import { getSupabase } from '@/lib/supabase/client';
import { BrandLogo, ArrumaBolsoIcon } from '@/components/ui/brand-logo';
import { toast } from 'sonner';
import { maskCurrency, parseCurrency } from '@/lib/financial/currency-mask';

// Dicas descontraídas e bem-humoradas de bolso
const POCKET_THOUGHTS = [
  {
    emoji: '☕',
    title: 'Sem culpa pelo cafezinho',
    text: 'Economizar não é passar vontade. O segredo é ter teto nos gastos e saber para onde cada centavo vai.',
    tag: 'Vida Real',
  },
  {
    emoji: '💳',
    title: 'Fatura sem susto',
    text: 'Chega de abrir o app do banco com um olho fechado e rezando. Aqui você vê exatamente o que vai fechar.',
    tag: 'Paz de Espírito',
  },
  {
    emoji: '🚀',
    title: 'Previsão de 12 meses',
    text: 'Descubra exatamente quando você vai se livrar daquele parcelamento e ver seu dinheiro sobrando.',
    tag: 'Futuro Garantido',
  },
  {
    emoji: '✨',
    title: 'Adeus planilhas feias',
    text: 'Tudo automatizado, modo escuro relaxante para a vista e gráficos que dão gosto de olhar todo dia.',
    tag: 'Nos Trinques',
  },
];

function LoginFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Preserva e valida a rota de retorno (ex: /expenses, /transactions)
  const redirectParam = searchParams.get('redirect');
  const safeRedirect = useMemo(() => {
    if (redirectParam && redirectParam.startsWith('/') && !redirectParam.startsWith('//')) {
      return redirectParam;
    }
    return '/';
  }, [redirectParam]);

  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  
  // Dica interativa rotativa
  const [thoughtIndex, setThoughtIndex] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setThoughtIndex((prev) => (prev + 1) % POCKET_THOUGHTS.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  // Signup form state
  const [fullName, setFullName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [baseIncome, setBaseIncome] = useState('');
  const [termsAccepted, setTermsAccepted] = useState(true);
  const [showSignupPassword, setShowSignupPassword] = useState(false);

  // Forgot password modal
  const [showForgotModal, setShowForgotModal] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [isSendingForgot, setIsSendingForgot] = useState(false);

  // Password Recovery Mode (quando o usuário clica no link do e-mail)
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  // States gerais
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [emailConfirmationNotice, setEmailConfirmationNotice] = useState<string | null>(null);

  // Recupera email lembrado anteriormente do localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const remembered = localStorage.getItem('gf_remembered_email');
      if (remembered) {
        setLoginEmail(remembered);
        setRememberMe(true);
      }
    }
  }, []);

  // Redireciona imediatamente se já houver sessão ativa válida no Supabase
  useEffect(() => {
    async function checkExistingAuth() {
      if (isRecoveryMode) return;
      const session = await FinancialService.getCurrentSession();
      if (session && session.user?.id) {
        router.replace(safeRedirect);
      }
    }
    checkExistingAuth();
  }, [router, safeRedirect, isRecoveryMode]);

  // Detector de fluxo de recuperação de senha
  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.includes('type=recovery')) {
      setIsRecoveryMode(true);
    }

    const client = getSupabase();
    if (client) {
      const { data } = client.auth.onAuthStateChange((event) => {
        if (event === 'PASSWORD_RECOVERY') {
          setIsRecoveryMode(true);
        }
      });
      return () => data.subscription.unsubscribe();
    }
  }, []);

  // Força da senha
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

  const signupStrength = getPasswordStrength(signupPassword);
  const recoveryStrength = getPasswordStrength(newPassword);
  const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  // Submissão do Login
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanMail = loginEmail.trim();
    if (!cleanMail || !loginPassword) {
      toast.error('Informe seu email e senha para entrar.');
      return;
    }
    if (!EMAIL_REGEX.test(cleanMail)) {
      toast.error('Informe um endereço de email válido.');
      return;
    }

    try {
      setIsSubmitting(true);
      if (rememberMe) {
        localStorage.setItem('gf_remembered_email', cleanMail);
      } else {
        localStorage.removeItem('gf_remembered_email');
      }

      const res = await FinancialService.signInWithEmail(cleanMail, loginPassword);
      if (res.error) {
        toast.error(res.error.message || 'Credenciais inválidas. Verifique seu email e senha.');
        return;
      }

      toast.success('Que bom te ver de volta! Acessando seu bolso...');
      setTimeout(() => {
        window.location.href = safeRedirect;
      }, 350);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao autenticar.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Submissão do Cadastro
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      toast.error('Conta pra gente como prefere ser chamado(a).');
      return;
    }
    if (!signupEmail.trim() || !EMAIL_REGEX.test(signupEmail.trim())) {
      toast.error('Informe um endereço de email válido.');
      return;
    }
    if (signupPassword.length < 6) {
      toast.error('A senha deve conter no mínimo 6 caracteres.');
      return;
    }
    if (signupPassword !== confirmPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }
    if (!termsAccepted) {
      toast.error('É necessário aceitar os Termos para continuar.');
      return;
    }

    try {
      setIsSubmitting(true);
      const parsedIncome = parseCurrency(baseIncome);
      const res = await FinancialService.signUpWithEmail(
        signupEmail, 
        signupPassword, 
        fullName, 
        parsedIncome
      );

      if (res.error) {
        toast.error(res.error.message || 'Erro ao registrar conta.');
        return;
      }

      if (res.data?.needsEmailConfirmation) {
        setEmailConfirmationNotice(signupEmail);
        setActiveTab('login');
        setLoginEmail(signupEmail);
        toast.info('Conta criada! Enviamos um link para o seu email confirmar antes de entrar.');
      } else {
        toast.success('Bem-vindo(a) ao ArrumaBolso! Tudo pronto para você.');
        setTimeout(() => {
          window.location.href = safeRedirect;
        }, 400);
      }
    } catch (err: any) {
      toast.error(err.message || 'Falha ao criar conta.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Solicitação de Link para Redefinição de Senha
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!forgotEmail.trim() || !EMAIL_REGEX.test(forgotEmail.trim())) {
      toast.error('Informe um email válido para recuperação.');
      return;
    }

    try {
      setIsSendingForgot(true);
      const { error } = await FinancialService.resetPasswordForEmail(forgotEmail.trim());
      if (error) {
        toast.error(error.message || 'Erro ao solicitar redefinição.');
        return;
      }
      toast.success('Link de recuperação enviado! Dá uma olhada na sua caixa de entrada.');
      setShowForgotModal(false);
      setForgotEmail('');
    } catch {
      toast.error('Erro ao enviar solicitação de recuperação.');
    } finally {
      setIsSendingForgot(false);
    }
  };

  // Salvar Nova Senha
  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('A nova senha deve ter no mínimo 6 caracteres.');
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error('As senhas digitadas não coincidem.');
      return;
    }

    try {
      setIsUpdatingPassword(true);
      const { error } = await FinancialService.updateUserPassword(newPassword);
      if (error) {
        toast.error(error.message || 'Erro ao redefinir senha.');
        return;
      }
      toast.success('Senha atualizada! Entrando na sua conta...');
      setIsRecoveryMode(false);
      setTimeout(() => {
        window.location.href = safeRedirect;
      }, 500);
    } catch (err: any) {
      toast.error(err.message || 'Falha ao atualizar a senha.');
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleGoogleAuth = async () => {
    try {
      setIsGoogleLoading(true);
      const res = await FinancialService.signInWithGoogle(safeRedirect);
      if (res?.error) {
        toast.error(res.error.message || 'Erro ao conectar com Google. Verifique a configuração do SSO no Supabase.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Erro ao autenticar com Google.');
    } finally {
      setIsGoogleLoading(false);
    }
  };

  const currentThought = POCKET_THOUGHTS[thoughtIndex];

  return (
    <div className="min-h-screen bg-[#070A11] text-foreground flex flex-col justify-between selection:bg-emerald-500/20 selection:text-emerald-400 relative overflow-hidden">
      {/* Ambient background glows for visual comfort */}
      <div className="absolute -top-32 -left-20 w-[550px] h-[450px] bg-emerald-500/10 blur-[150px] pointer-events-none rounded-full" />
      <div className="absolute top-1/2 -right-32 w-[500px] h-[400px] bg-teal-500/5 blur-[160px] pointer-events-none rounded-full" />
      <div className="absolute -bottom-20 left-1/3 w-[450px] h-[350px] bg-amber-500/5 blur-[140px] pointer-events-none rounded-full" />

      {/* Main Content Area */}
      <main className="flex-1 flex items-center justify-center px-4 py-8 sm:py-12 relative z-10">
        <div className="w-full max-w-5xl">

          {/* MODO DE RECUPERAÇÃO DE SENHA */}
          {isRecoveryMode ? (
            <div className="max-w-md mx-auto p-6 sm:p-8 rounded-2xl bg-[#0D131F]/90 border border-border/80 shadow-2xl backdrop-blur-xl space-y-4">
              <div className="text-center mb-6 space-y-1.5">
                <div className="w-11 h-11 rounded-2xl bg-emerald-500/10 text-emerald-400 mx-auto flex items-center justify-center mb-3 border border-emerald-500/20">
                  <KeyRound className="w-5 h-5" />
                </div>
                <h1 className="text-xl font-bold tracking-tight text-foreground">
                  Definir Nova Senha
                </h1>
                <p className="text-xs text-muted-foreground">
                  Crie uma nova senha para acessar sua conta ArrumaBolso com segurança.
                </p>
              </div>

              <form onSubmit={handleUpdatePassword} className="space-y-3.5">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      enterKeyHint="next"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Mínimo 6 caracteres"
                      className="w-full pl-9 pr-11 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground p-1.5"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">
                    Confirmar Nova Senha
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      autoComplete="new-password"
                      enterKeyHint="done"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Repita a nova senha"
                      className="w-full pl-9 pr-3 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                    />
                  </div>
                </div>

                {newPassword && (
                  <div className="flex items-center gap-1.5 pt-0.5">
                    <div className="grid grid-cols-4 gap-1 flex-1 h-1">
                      {[1, 2, 3, 4].map((step) => (
                        <div
                          key={step}
                          className={`rounded-full transition-colors ${
                            recoveryStrength.score >= step ? recoveryStrength.color : 'bg-secondary'
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-[10px] text-muted-foreground">{recoveryStrength.label}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isUpdatingPassword}
                  className="w-full mt-3 py-3 sm:py-2.5 min-h-[48px] sm:min-h-[42px] rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-xs shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
                >
                  {isUpdatingPassword ? (
                    <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      <span>Salvar Nova Senha</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setIsRecoveryMode(false)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground transition-colors text-center"
                >
                  Voltar para a tela de login
                </button>
              </form>
            </div>
          ) : (
            /* LAYOUT PRINCIPAL: 2 COLUNAS EM TELAS GRANDES */
            /* LAYOUT PRINCIPAL: MOBILE-FIRST RESPONSIVO */
            <div className="flex flex-col lg:grid lg:grid-cols-12 gap-6 lg:gap-12 items-center w-full">

              {/* Mega Destaque da Marca no Topo EXCLUSIVO para Mobile (Ícone 100% Idêntico com Glow) */}
              <div className="lg:hidden flex flex-col items-center text-center gap-3 pt-2 pb-1 w-full select-none">
                <ArrumaBolsoIcon className="w-20 h-20" glow={true} />

                <div className="flex flex-col items-center">
                  <div className="text-3xl font-black tracking-tight text-white flex items-center leading-none">
                    <span>Arruma</span>
                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">
                      Bolso
                    </span>
                  </div>
                  <span className="text-xs font-semibold text-emerald-400/90 tracking-wide mt-2 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    Suas finanças nos trinques
                  </span>
                  <span className="text-[11px] text-muted-foreground/80 mt-0.5">
                    Previsibilidade, controle de cartões e metas sem estresse
                  </span>
                </div>
              </div>
              
              {/* CARD DE AUTENTICAÇÃO: No Mobile vem no topo (order-1), no Desktop fica na direita (order-2) */}
              <div className="order-1 lg:order-2 lg:col-span-6 max-w-md mx-auto w-full">
                <div className="p-5 sm:p-8 rounded-2xl bg-[#0D131F]/90 border border-border/80 shadow-2xl backdrop-blur-xl relative">
                  {/* Cabeçalho do Card */}
                  <div className="mb-4 sm:mb-5 space-y-1">
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
                      {activeTab === 'login' ? (
                        <>
                          <span>Bora conferir o bolso?</span>
                          <span className="text-base">👋</span>
                        </>
                      ) : (
                        <>
                          <span>Criar meu bolso</span>
                          <Sparkles className="w-4 h-4 text-emerald-400" />
                        </>
                      )}
                    </h2>
                    <p className="text-xs text-muted-foreground">
                      {activeTab === 'login' 
                        ? 'Entre com suas credenciais para ver seu painel nos trinques.' 
                        : 'Leva menos de 1 minuto para colocar suas finanças em ordem.'}
                    </p>
                    {redirectParam && (
                      <div className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-secondary text-[10px] text-muted-foreground border border-border mt-1">
                        <span>Você será redirecionado para a página solicitada após entrar.</span>
                      </div>
                    )}
                  </div>

                  {/* Segmented Switcher com área de toque ergonômica */}
                  <div className="grid grid-cols-2 p-1 rounded-xl bg-secondary/70 border border-border/80 text-xs font-medium mb-4 sm:mb-5">
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('login');
                        setEmailConfirmationNotice(null);
                      }}
                      className={`min-h-[42px] sm:min-h-[36px] py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center font-medium ${
                        activeTab === 'login'
                          ? 'bg-card text-foreground shadow-sm font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Já tenho conta
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveTab('signup');
                        setEmailConfirmationNotice(null);
                      }}
                      className={`min-h-[42px] sm:min-h-[36px] py-2 px-3 rounded-lg transition-all cursor-pointer flex items-center justify-center font-medium ${
                        activeTab === 'signup'
                          ? 'bg-card text-foreground shadow-sm font-bold'
                          : 'text-muted-foreground hover:text-foreground'
                      }`}
                    >
                      Quero começar
                    </button>
                  </div>

                  {/* Banner de Confirmação de Email */}
                  {emailConfirmationNotice && (
                    <div className="mb-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" />
                      <div>
                        <span className="font-semibold block">Confirmação enviada!</span>
                        Enviamos um link para <strong>{emailConfirmationNotice}</strong>. Dá um clique lá para liberar seu acesso.
                      </div>
                    </div>
                  )}

                  {/* FORMULÁRIO DE LOGIN */}
                  {activeTab === 'login' && (
                    <form onSubmit={handleLogin} className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">
                          Seu Email
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            inputMode="email"
                            enterKeyHint="next"
                            value={loginEmail}
                            onChange={(e) => setLoginEmail(e.target.value)}
                            placeholder="seu.email@exemplo.com"
                            className="w-full pl-9 pr-3 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-medium text-muted-foreground">
                            Sua Senha
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setForgotEmail(loginEmail);
                              setShowForgotModal(true);
                            }}
                            className="text-[11px] text-muted-foreground hover:text-primary transition-colors cursor-pointer py-1"
                          >
                            Esqueceu a senha?
                          </button>
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type={showLoginPassword ? 'text' : 'password'}
                            required
                            autoComplete="current-password"
                            enterKeyHint="go"
                            value={loginPassword}
                            onChange={(e) => setLoginPassword(e.target.value)}
                            placeholder="••••••••"
                            className="w-full pl-9 pr-11 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                          />
                          <button
                            type="button"
                            onClick={() => setShowLoginPassword(!showLoginPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/60 hover:text-foreground cursor-pointer p-1.5"
                            aria-label="Alternar visibilidade da senha"
                          >
                            {showLoginPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                          </button>
                        </div>
                      </div>

                      {/* Lembrar de mim */}
                      <div className="flex items-center justify-between pt-0.5">
                        <label className="flex items-center gap-2.5 cursor-pointer select-none text-xs text-muted-foreground hover:text-foreground transition-colors py-1">
                          <input
                            type="checkbox"
                            checked={rememberMe}
                            onChange={(e) => setRememberMe(e.target.checked)}
                            className="w-4 h-4 rounded border-border text-primary focus:ring-primary accent-emerald-500 cursor-pointer"
                          />
                          <span>Lembrar de mim neste aparelho</span>
                        </label>
                      </div>

                      {/* Botão de Entrar */}
                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 py-3 sm:py-2.5 min-h-[48px] sm:min-h-[42px] rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-xs shadow-md shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
                      >
                        {isSubmitting ? (
                          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Entrar no meu Bolso</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Divisor */}
                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border/60"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase">
                          <span className="bg-[#0D131F] px-2 text-muted-foreground/70">
                            ou
                          </span>
                        </div>
                      </div>

                      {/* Botão Google */}
                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={isGoogleLoading}
                        className="w-full py-3 sm:py-2.5 min-h-[48px] sm:min-h-[42px] rounded-xl bg-secondary/60 hover:bg-secondary border border-border/80 text-foreground font-medium text-xs sm:text-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                        <span>Entrar com Google</span>
                      </button>
                    </form>
                  )}

                  {/* FORMULÁRIO DE CADASTRO */}
                  {activeTab === 'signup' && (
                    <form onSubmit={handleSignup} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Como quer ser chamado(a)?</label>
                        <div className="relative">
                          <User className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            autoComplete="name"
                            enterKeyHint="next"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Seu nome ou apelido"
                            className="w-full pl-9 pr-3 py-3 sm:py-2 min-h-[46px] sm:min-h-[38px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground">Seu Melhor Email</label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-muted-foreground/60 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="email"
                            required
                            autoComplete="email"
                            inputMode="email"
                            enterKeyHint="next"
                            value={signupEmail}
                            onChange={(e) => setSignupEmail(e.target.value)}
                            placeholder="seu.email@exemplo.com"
                            className="w-full pl-9 pr-3 py-3 sm:py-2 min-h-[46px] sm:min-h-[38px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Criar Senha</label>
                          <div className="relative">
                            <input
                              type={showSignupPassword ? 'text' : 'password'}
                              required
                              autoComplete="new-password"
                              enterKeyHint="next"
                              value={signupPassword}
                              onChange={(e) => setSignupPassword(e.target.value)}
                              placeholder="Mínimo 6 dígitos"
                              className="w-full px-3 py-3 sm:py-2 min-h-[46px] sm:min-h-[38px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-xs font-medium text-muted-foreground">Confirmar Senha</label>
                          <div className="relative">
                            <input
                              type={showSignupPassword ? 'text' : 'password'}
                              required
                              autoComplete="new-password"
                              enterKeyHint="done"
                              value={confirmPassword}
                              onChange={(e) => setConfirmPassword(e.target.value)}
                              placeholder="Repita a senha"
                              className="w-full px-3 py-3 sm:py-2 min-h-[46px] sm:min-h-[38px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all"
                            />
                          </div>
                        </div>
                      </div>

                      {signupPassword && (
                        <div className="flex items-center gap-1.5 pt-0.5">
                          <div className="grid grid-cols-4 gap-1 flex-1 h-1">
                            {[1, 2, 3, 4].map((step) => (
                              <div
                                key={step}
                                className={`rounded-full transition-colors ${
                                  signupStrength.score >= step ? signupStrength.color : 'bg-secondary'
                                }`}
                              />
                            ))}
                          </div>
                          <span className="text-[10px] text-muted-foreground">{signupStrength.label}</span>
                        </div>
                      )}

                      {/* Renda Mensal com máscara automática */}
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-muted-foreground flex justify-between">
                          <span>Renda Mensal Base Estimada</span>
                          <span className="text-[10px] text-muted-foreground/70">Opcional</span>
                        </label>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground font-semibold">
                            R$
                          </span>
                          <input
                            type="text"
                            inputMode="decimal"
                            value={baseIncome}
                            onChange={(e) => setBaseIncome((prev) => maskCurrency(e.target.value, prev))}
                            placeholder="0,00"
                            className="w-full pl-9 pr-3 py-3 sm:py-2 min-h-[46px] sm:min-h-[38px] rounded-xl bg-secondary/40 border border-border/80 text-[16px] sm:text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 transition-all font-mono tabular-nums"
                          />
                        </div>
                        <span className="text-[10px] text-muted-foreground/70 block">
                          Pode ser salário ou freelas. Ajuste quando quiser.
                        </span>
                      </div>

                      <div className="flex items-start gap-2.5 pt-1 text-xs text-muted-foreground">
                        <input
                          type="checkbox"
                          id="terms"
                          checked={termsAccepted}
                          onChange={(e) => setTermsAccepted(e.target.checked)}
                          className="w-4 h-4 mt-0.5 rounded border-border text-primary focus:ring-primary accent-emerald-500 cursor-pointer"
                        />
                        <label htmlFor="terms" className="leading-tight text-[11px] cursor-pointer">
                          Concordo com os Termos de Uso e prometo cuidar bem do meu bolso.
                        </label>
                      </div>

                      <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full mt-2 py-3 sm:py-2.5 min-h-[48px] sm:min-h-[42px] rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-sm sm:text-xs shadow-md shadow-emerald-950/40 transition-all flex items-center justify-center gap-2 disabled:opacity-60 cursor-pointer active:scale-[0.99]"
                      >
                        {isSubmitting ? (
                          <span className="inline-block w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <>
                            <span>Criar Minha Conta</span>
                            <ArrowRight className="w-4 h-4" />
                          </>
                        )}
                      </button>

                      {/* Divisor */}
                      <div className="relative py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border/60"></div>
                        </div>
                        <div className="relative flex justify-center text-[10px] uppercase">
                          <span className="bg-[#0D131F] px-2 text-muted-foreground/70">
                            ou
                          </span>
                        </div>
                      </div>

                      {/* Botão Google para Cadastro */}
                      <button
                        type="button"
                        onClick={handleGoogleAuth}
                        disabled={isGoogleLoading}
                        className="w-full py-3 sm:py-2.5 min-h-[48px] sm:min-h-[42px] rounded-xl bg-secondary/60 hover:bg-secondary border border-border/80 text-foreground font-medium text-xs sm:text-xs transition-colors flex items-center justify-center gap-2.5 cursor-pointer active:scale-[0.99]"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.14z"/>
                          <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.34 24 12 24z"/>
                          <path fill="#FBBC05" d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.15z"/>
                          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.34 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"/>
                        </svg>
                        <span>Cadastrar com Google</span>
                      </button>
                    </form>
                  )}

                </div>
              </div>

              {/* COLUNA ESQUERDA: EXPERIÊNCIA DA MARCA E PENSAMENTOS DE BOLSO (no Desktop fica à esquerda, no mobile fica abaixo do formulário) */}
              <div className="order-2 lg:order-1 lg:col-span-6 space-y-6 text-center lg:text-left w-full max-w-md lg:max-w-none mx-auto">
                {/* Mega Destaque da Marca: Exclusivo Desktop */}
                <div className="hidden lg:flex flex-row items-start gap-5 justify-start pt-1 select-none">
                  <ArrumaBolsoIcon className="w-24 h-24" glow={true} />

                  <div className="flex flex-col items-start text-left justify-center">
                    <div className="text-4xl sm:text-5xl lg:text-[46px] font-black tracking-tight text-white flex items-center leading-none">
                      <span>Arruma</span>
                      <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-300 to-emerald-400">
                        Bolso
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-emerald-400/90 tracking-wide mt-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                      Suas finanças nos trinques
                    </span>
                    <span className="text-xs text-muted-foreground/80 mt-0.5">
                      Previsibilidade, controle de cartões e metas sem estresse
                    </span>
                  </div>
                </div>

                {/* Badge Descontraído */}
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/60 border border-border/80 text-xs text-foreground/80">
                  <span className="text-sm">🎯</span>
                  <span>Chega de susto no fim do mês</span>
                </div>

                {/* Título Principal Marcante */}
                <div className="space-y-2">
                  <h2 className="text-xl sm:text-2xl lg:text-3xl font-extrabold tracking-tight text-white/95 leading-snug">
                    Organizar o dinheiro não precisa ser uma tortura.
                  </h2>
                  <p className="text-xs sm:text-sm text-muted-foreground/90 max-w-lg mx-auto lg:mx-0 leading-relaxed">
                    Reúna seus cartões, parcelamentos futuros e contas fixas em um só lugar. Sem termos complicados de banco e sem planilhas feias de Excel.
                  </p>
                </div>

                {/* Card Interativo: Pensamento de Bolso Dinâmico */}
                <div className="p-4 sm:p-5 rounded-2xl bg-[#0D131F]/80 border border-border/70 backdrop-blur-md relative overflow-hidden shadow-lg shadow-black/40 text-left">
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{currentThought.emoji}</span>
                      <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
                        {currentThought.tag}
                      </span>
                    </div>
                    {/* Indicadores de Dica Interativa com área de toque mínima */}
                    <div className="flex items-center gap-2 py-1">
                      {POCKET_THOUGHTS.map((_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setThoughtIndex(i)}
                          aria-label={`Ver dica ${i + 1}`}
                          className={`h-2.5 rounded-full transition-all cursor-pointer ${
                            thoughtIndex === i 
                              ? 'bg-emerald-400 w-6' 
                              : 'bg-zinc-700 hover:bg-zinc-500 w-2.5'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  <h4 className="text-xs font-bold text-foreground mb-1">
                    {currentThought.title}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    "{currentThought.text}"
                  </p>
                </div>

                {/* 3 Benefícios Rápidos */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1 text-left">
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <span className="text-xs font-semibold text-foreground block">⚡ Faturas na mão</span>
                    <span className="text-[11px] text-muted-foreground">Importe CSV do Nubank em 2 segundos.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <span className="text-xs font-semibold text-foreground block">📈 Visão de 1 ano</span>
                    <span className="text-[11px] text-muted-foreground">Saiba onde seu caixa estará em 12 meses.</span>
                  </div>
                  <div className="p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <span className="text-xs font-semibold text-foreground block">🔒 100% Seu</span>
                    <span className="text-[11px] text-muted-foreground">Privacidade total com modo camuflagem.</span>
                  </div>
                </div>
              </div>

            </div>
          )}

        </div>
      </main>

      {/* Modal: Esqueci Minha Senha */}
      {showForgotModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-md p-4 animate-in fade-in-0 duration-200">
          <div className="bg-[#0D131F] border border-border/80 rounded-2xl max-w-sm w-full p-6 shadow-2xl relative space-y-3.5">
            <button
              onClick={() => setShowForgotModal(false)}
              className="absolute top-4 right-4 text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary cursor-pointer transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2.5 text-foreground font-bold text-sm">
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <KeyRound className="w-4 h-4" />
              </div>
              <span>Recuperar Acesso</span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Sem estresse! Digite seu email abaixo e vamos te enviar um link mágico para redefinir sua senha.
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-3 pt-1">
              <input
                type="email"
                required
                autoComplete="email"
                inputMode="email"
                enterKeyHint="go"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="seu.email@exemplo.com"
                className="w-full px-3 py-3 sm:py-2.5 min-h-[46px] sm:min-h-[40px] rounded-xl bg-secondary/50 border border-border/80 text-[16px] sm:text-xs text-foreground focus:outline-none focus:border-primary"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotModal(false)}
                  className="px-3 py-2.5 min-h-[44px] sm:min-h-[38px] rounded-xl text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex items-center justify-center"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSendingForgot}
                  className="px-4 py-2.5 min-h-[44px] sm:min-h-[38px] rounded-xl bg-primary hover:bg-primary/90 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5 disabled:opacity-60 cursor-pointer"
                >
                  {isSendingForgot ? (
                    <span className="inline-block w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <span>Enviar link de recuperação</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rodapé Minimalista Descontraído com Safe Area iOS */}
      <footer className="w-full py-4 px-6 text-center text-[11px] text-muted-foreground/60 border-t border-border/30 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-5xl mx-auto safe-area-pb">
        <div className="flex items-center gap-1.5">
          <span>&copy; {new Date().getFullYear()} ArrumaBolso</span>
          <span>•</span>
          <span>Feito para quem gosta de dinheiro no bolso</span>
        </div>
        <div className="flex items-center gap-3 text-muted-foreground/80">
          <span className="hover:text-foreground transition-colors">Privacidade</span>
          <span>•</span>
          <span className="hover:text-foreground transition-colors">Segurança Bancária</span>
        </div>
      </footer>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#070A11] text-foreground flex items-center justify-center">
        <div className="w-7 h-7 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
      </div>
    }>
      <LoginFormContent />
    </Suspense>
  );
}
