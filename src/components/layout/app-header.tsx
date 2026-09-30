'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { 
  Plus, 
  Upload, 
  Calendar, 
  Menu, 
  X, 
  LayoutDashboard, 
  ReceiptText, 
  FileSpreadsheet, 
  Target, 
  Database,
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  CreditCard,
  Eye,
  EyeOff,
  Search,
  Settings,
  ChevronLeft,
  ChevronRight,
  Clock
} from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { FinancialService } from '@/lib/services/financial-service';
import { useTransactions } from '@/hooks/use-financial';
import { BrandLogo, ArrumaBolsoIcon } from '@/components/ui/brand-logo';
import { usePrivacy } from '@/components/providers/privacy-provider';
import { usePeriod } from '@/components/providers/period-provider';
import { CommandPalette } from '@/components/ui/command-palette';
import { useKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts';
import { toast } from 'sonner';

interface AppHeaderProps {
  onOpenNewTransaction?: (type?: 'expense' | 'income') => void;
  selectedMonth?: string;
  onMonthChange?: (val: string) => void;
}

export function AppHeader({
  onOpenNewTransaction,
  selectedMonth,
  onMonthChange
}: AppHeaderProps) {
  const router = useRouter();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Registra atalhos globais de teclado (Ctrl+K, N, P)
  useKeyboardShortcuts({
    onOpenCommandPalette: () => setCommandPaletteOpen(prev => !prev),
    onOpenNewTransaction: () => onOpenNewTransaction?.('expense'),
    onTogglePrivacy: () => {
      togglePrivacyMode();
      toast.info(!isPrivacyMode ? 'Modo Privacidade ativado: valores ocultos' : 'Modo Privacidade desativado');
    },
  });

  const {
    selectedMonth: globalMonth,
    setSelectedMonth: setGlobalMonth,
    availableMonths,
    canGoPrevious,
    canGoNext,
    goToPreviousMonth,
    goToNextMonth,
    goToCurrentMonth,
    isCurrentMonth,
    isFutureMonth
  } = usePeriod();

  const activeMonth = selectedMonth || globalMonth;

  const handlePeriodChange = (val: string) => {
    setGlobalMonth(val);
    onMonthChange?.(val);
  };

  useEffect(() => {
    async function checkRole() {
      const session = await FinancialService.getCurrentSession();
      setIsAdmin(session?.user?.role === 'admin');
    }
    checkRole();
  }, []);

  return (
    <header className="h-16 border-b border-border/70 bg-background/80 backdrop-blur-md px-3 sm:px-6 md:px-8 flex items-center justify-between sticky top-0 z-20">
      {/* Left side: Mobile menu toggle + Mobile Brand Logo + Selected Period selector */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="md:hidden p-1.5 sm:p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors shrink-0"
          aria-label="Abrir Menu"
        >
          {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </button>

        <Link href="/" className="md:hidden shrink-0 flex items-center" aria-label="Início ArrumaBolso">
          <div className="hidden sm:flex items-center">
            <BrandLogo size="sm" showTagline={false} />
          </div>
          <div className="sm:hidden flex items-center">
            <ArrumaBolsoIcon size="xs" glow={false} />
          </div>
        </Link>

        {/* Automatic Period Selector with Fast Navigation (< e >) */}
        <div className="flex items-center gap-1 sm:gap-1.5 min-w-0">
          {/* Botão Mês Anterior (<) */}
          <button
            type="button"
            onClick={goToPreviousMonth}
            disabled={!canGoPrevious}
            className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/70 disabled:opacity-25 disabled:pointer-events-none transition-colors shrink-0"
            title="Mês Anterior (apenas com dados salvos)"
            aria-label="Mês Anterior"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>

          {/* Seletor Central Automático */}
          <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-secondary/50 border border-border/80 text-xs sm:text-sm font-medium transition-colors hover:bg-secondary/80 min-w-0">
            <Calendar className={`w-3.5 h-3.5 shrink-0 ${
              isCurrentMonth ? 'text-emerald-400' : isFutureMonth ? 'text-violet-400' : 'text-muted-foreground'
            }`} />
            <select 
              value={activeMonth}
              onChange={(e) => handlePeriodChange(e.target.value)}
              className="bg-transparent text-foreground font-semibold text-xs sm:text-sm focus:outline-none cursor-pointer truncate max-w-[105px] xs:max-w-[130px] sm:max-w-none"
            >
              {availableMonths.map((opt) => (
                <option key={opt.key} value={opt.key} className="bg-card text-foreground">
                  {opt.label} • {opt.tag}
                </option>
              ))}
            </select>
          </div>

          {/* Botão Próximo Mês (>) */}
          <button
            type="button"
            onClick={goToNextMonth}
            disabled={!canGoNext}
            className="p-1 sm:p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/70 disabled:opacity-25 disabled:pointer-events-none transition-colors shrink-0"
            title="Próximo Mês (apenas com parcelas de cartão)"
            aria-label="Próximo Mês"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Botão Atalho "Hoje" quando estiver em outro mês */}
          {!isCurrentMonth && (
            <button
              type="button"
              onClick={goToCurrentMonth}
              className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[11px] font-bold transition-all animate-in fade-in"
              title="Voltar ao Mês Atual"
            >
              <Clock className="w-3 h-3" />
              Hoje
            </button>
          )}
        </div>
      </div>

      {/* Right side: Actions */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Mobile Quick Search Button */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="sm:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary border border-border/70 transition-colors"
          title="Buscar ou comando"
          aria-label="Buscar ou comando"
        >
          <Search className="w-4 h-4 text-emerald-400" />
        </button>

        {/* Desktop Quick Search & Command Palette Button */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary/50 hover:bg-secondary text-xs text-muted-foreground hover:text-foreground border border-border/80 transition-colors"
          title="Abrir busca rápida e comandos (Ctrl + K)"
        >
          <Search className="w-3.5 h-3.5 text-emerald-400" />
          <span className="hidden lg:inline">Buscar ou comando...</span>
          <span className="lg:hidden">Buscar</span>
          <kbd className="text-[10px] font-mono px-1 py-0.2 rounded bg-card border border-border text-foreground">
            Ctrl+K
          </kbd>
        </button>

        {/* Privacy Mode Toggle Button (Olho Mágico) */}
        <button
          onClick={() => {
            togglePrivacyMode();
            toast.info(!isPrivacyMode ? 'Modo Privacidade ativado: valores ocultos' : 'Modo Privacidade desativado');
          }}
          title={isPrivacyMode ? 'Desativar Modo Privacidade (mostrar valores)' : 'Ativar Modo Privacidade (ocultar valores com R$ ••••••)'}
          className={`p-2 rounded-lg transition-colors border ${
            isPrivacyMode 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-sm' 
              : 'bg-secondary/40 border-border/70 text-muted-foreground hover:text-foreground hover:bg-secondary'
          }`}
          aria-label="Alternar Modo Privacidade"
        >
          {isPrivacyMode ? <EyeOff className="w-4 h-4 text-emerald-400" /> : <Eye className="w-4 h-4" />}
        </button>

        <Link
          href="/import"
          className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-medium rounded-lg bg-secondary hover:bg-secondary/80 text-foreground border border-border/70 transition-colors"
        >
          <Upload className="w-3.5 h-3.5 text-muted-foreground" />
          <span>Importar Nubank</span>
        </Link>

        {onOpenNewTransaction && (
          <button
            onClick={() => onOpenNewTransaction('expense')}
            className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all active:scale-[0.98]"
          >
            <Plus className="w-4 h-4" />
            <span>Nova Transação</span>
          </button>
        )}
      </div>

      {/* Mobile Drawer Backdrop */}
      {mobileMenuOpen && (
        <div 
          className="md:hidden fixed inset-0 top-16 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-150"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-x-0 top-16 bg-card/95 backdrop-blur-xl border-b border-border p-4 shadow-2xl flex flex-col gap-1 z-50 max-h-[calc(100dvh-4.5rem)] overflow-y-auto animate-in slide-in-from-top-2 duration-200">
          <div className="pb-3 px-1 border-b border-border/70 mb-2">
            <BrandLogo size="md" />
          </div>
          <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <LayoutDashboard className="w-4 h-4 text-muted-foreground" />
            Dashboard
          </Link>
          <Link
            href="/incomes"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowUpRight className="w-4 h-4 text-emerald-500" />
            Receitas (Entradas)
          </Link>
          <Link
            href="/expenses"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <ArrowDownRight className="w-4 h-4 text-rose-500" />
            Despesas (Saídas)
          </Link>
          <Link
            href="/cards"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <CreditCard className="w-4 h-4 text-violet-400" />
            Cartões de Crédito
          </Link>
          <Link
            href="/fixed-debts"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Repeat className="w-4 h-4 text-primary" />
            Mensalidades & Dívidas
          </Link>
          <Link
            href="/goals"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Target className="w-4 h-4 text-primary" />
            Metas Financeiras
          </Link>
          <Link
            href="/transactions"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <ReceiptText className="w-4 h-4 text-muted-foreground" />
            Extrato Geral
          </Link>
          <Link
            href="/import"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4 text-muted-foreground" />
            Importar Extratos (OFX/CSV)
          </Link>
          <Link
            href="/settings"
            onClick={() => setMobileMenuOpen(false)}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
          >
            <Settings className="w-4 h-4 text-muted-foreground" />
            Configurações & Perfil
          </Link>
          {isAdmin && (
            <>
              <Link
                href="/database"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-secondary transition-colors"
              >
                <Database className="w-4 h-4 text-muted-foreground" />
                Banco Supabase & DDL
              </Link>
              <Link
                href="/admin"
                onClick={() => setMobileMenuOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-bold text-amber-500 hover:bg-secondary"
              >
                <Target className="w-4 h-4 text-amber-500" />
                Gestão de Contas (Admin)
              </Link>
            </>
          )}

          <div className="h-px bg-border my-1" />

          <button
            onClick={async () => {
              setMobileMenuOpen(false);
              await FinancialService.signOut();
              toast.success('Sessão encerrada com sucesso.');
              router.push('/login');
            }}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-rose-400 hover:bg-rose-500/10 transition-colors w-full text-left"
          >
            <LogOut className="w-4 h-4" />
            Sair da Conta
          </button>
        </div>
      )}

      {/* Command Palette Modal */}
      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenNewTransaction={onOpenNewTransaction}
      />
    </header>
  );
}
