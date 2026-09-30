'use client';

import React, { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Image from 'next/image';
import { FinancialService } from '@/lib/services/financial-service';
import { getSupabase } from '@/lib/supabase/client';
import { ShieldCheck, Loader2 } from 'lucide-react';
import { BrandLogo } from '@/components/ui/brand-logo';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';

  // Estado inicial sincronizado entre SSR e cliente para prevenir erro de hidratação
  const [status, setStatus] = useState<'checking' | 'authorized' | 'unauthorized'>(
    isLoginPage ? 'authorized' : 'checking'
  );

  const redirectToLogin = React.useCallback(() => {
    const fullPath = typeof window !== 'undefined'
      ? `${window.location.pathname}${window.location.search}`
      : pathname;
    
    if (fullPath && fullPath !== '/' && fullPath !== '/login') {
      router.replace(`/login?redirect=${encodeURIComponent(fullPath)}`);
    } else {
      router.replace('/login');
    }
  }, [pathname, router]);

  useEffect(() => {
    // Se estiver na rota de login, não bloqueia
    if (isLoginPage) {
      setStatus('authorized');
      return;
    }

    // Pós-hidratação imediata no cliente: se houver sessão em cache, autoriza instantaneamente
    try {
      const cached = localStorage.getItem('gf_session');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.user?.id) {
          setStatus('authorized');
        }
      } else if (FinancialService.getActiveUserId()) {
        setStatus('authorized');
      }
    } catch {}

    let isMounted = true;

    async function verifyAuth() {
      try {
        const session = await FinancialService.getCurrentSession();
        if (!isMounted) return;

        if (session && session.user && session.user.id) {
          setStatus('authorized');
        } else {
          setStatus('unauthorized');
          redirectToLogin();
        }
      } catch (err) {
        if (!isMounted) return;
        console.warn('Falha na validação de sessão:', err);
        // Tolerância a falhas: só ejeta se não houver usuário local válido
        if (!FinancialService.getActiveUserId()) {
          setStatus('unauthorized');
          redirectToLogin();
        }
      }
    }

    verifyAuth();

    // Ouvinte em tempo real de eventos de autenticação do Supabase
    const client = getSupabase();
    let authListener: any = null;

    if (client) {
      const { data } = client.auth.onAuthStateChange(async (event, session) => {
        if (!isMounted) return;

        if (event === 'SIGNED_OUT') {
          setStatus('unauthorized');
          redirectToLogin();
        } else if (session?.user) {
          FinancialService.ensureUserProvisioned(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.full_name
          ).catch(console.warn);
          setStatus('authorized');
        }
      });
      authListener = data.subscription;
    }

    return () => {
      isMounted = false;
      if (authListener) {
        authListener.unsubscribe();
      }
    };
  }, [isLoginPage, redirectToLogin]);

  // Se estiver na página de login, renderiza livremente
  if (isLoginPage) {
    return <>{children}</>;
  }

  // Se ainda estiver verificando ou se for não-autorizado (enquanto redireciona para /login)
  if (status !== 'authorized') {
    return (
      <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center relative overflow-hidden select-none">
        {/* Luzes ambiente de fundo */}
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-primary/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/4 right-1/3 w-80 h-80 rounded-full bg-amber-500/10 blur-[130px] pointer-events-none" />

        <div className="relative z-10 flex flex-col items-center gap-5 px-4 text-center max-w-sm">
          <BrandLogo size="xl" showTagline={false} />

          <div className="space-y-1.5">
            <h1 className="text-xl font-extrabold tracking-tight text-foreground">
              Arruma<span className="text-emerald-400">Bolso</span>
            </h1>
            <p className="text-xs text-muted-foreground flex items-center justify-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-400" />
              <span>Verificando autenticação segura...</span>
            </p>
          </div>

          <div className="px-3 py-1 rounded-full bg-secondary/80 border border-border text-[11px] text-muted-foreground">
            Acesso protegido &bull; Suas finanças nos trinques
          </div>
        </div>
      </div>
    );
  }

  // Usuário 100% autenticado no Supabase
  return <>{children}</>;
}
