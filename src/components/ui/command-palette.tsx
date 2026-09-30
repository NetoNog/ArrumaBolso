'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Repeat, 
  Target, 
  ReceiptText, 
  FileSpreadsheet, 
  Database, 
  Plus, 
  Eye, 
  EyeOff, 
  Download, 
  Command,
  X,
  CreditCard,
  Settings
} from 'lucide-react';
import { usePrivacy } from '@/components/providers/privacy-provider';
import { toast } from 'sonner';

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenNewTransaction?: (type: 'expense' | 'income') => void;
}

interface CommandItem {
  id: string;
  category: 'Navegação' | 'Ações Rápidas' | 'Privacidade';
  title: string;
  subtitle?: string;
  icon: React.ElementType;
  shortcut?: string;
  action: () => void;
}

export function CommandPalette({ isOpen, onClose, onOpenNewTransaction }: CommandPaletteProps) {
  const router = useRouter();
  const { isPrivacyMode, togglePrivacyMode } = usePrivacy();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const commands: CommandItem[] = [
    // Ações Rápidas
    {
      id: 'new-expense',
      category: 'Ações Rápidas',
      title: 'Nova Despesa',
      subtitle: 'Registrar saída no cartão ou dinheiro',
      icon: ArrowDownRight,
      shortcut: 'N',
      action: () => {
        onClose();
        onOpenNewTransaction?.('expense');
      },
    },
    {
      id: 'new-income',
      category: 'Ações Rápidas',
      title: 'Nova Receita',
      subtitle: 'Registrar salário, rendimento ou entrada',
      icon: ArrowUpRight,
      action: () => {
        onClose();
        onOpenNewTransaction?.('income');
      },
    },
    {
      id: 'toggle-privacy',
      category: 'Privacidade',
      title: isPrivacyMode ? 'Desativar Modo Privacidade' : 'Ativar Modo Privacidade (Olho Mágico)',
      subtitle: isPrivacyMode ? 'Exibir valores reais das contas' : 'Ocultar todos os saldos e valores (R$ ••••••)',
      icon: isPrivacyMode ? Eye : EyeOff,
      shortcut: 'P',
      action: () => {
        togglePrivacyMode();
        toast.info(isPrivacyMode ? 'Modo Privacidade desativado' : 'Modo Privacidade ativado: valores ocultos');
        onClose();
      },
    },
    // Navegação
    {
      id: 'nav-dashboard',
      category: 'Navegação',
      title: 'Dashboard Geral',
      subtitle: 'Visão executiva e fluxo de caixa',
      icon: LayoutDashboard,
      action: () => {
        router.push('/');
        onClose();
      },
    },
    {
      id: 'nav-incomes',
      category: 'Navegação',
      title: 'Receitas (Entradas)',
      subtitle: 'Histórico de salários e recebimentos',
      icon: ArrowUpRight,
      action: () => {
        router.push('/incomes');
        onClose();
      },
    },
    {
      id: 'nav-expenses',
      category: 'Navegação',
      title: 'Despesas (Saídas)',
      subtitle: 'Detalhamento de gastos e categorias',
      icon: ArrowDownRight,
      action: () => {
        router.push('/expenses');
        onClose();
      },
    },
    {
      id: 'nav-cards',
      category: 'Navegação',
      title: 'Cartões de Crédito & Faturas',
      subtitle: 'Limites, faturas abertas e parcelas futuras',
      icon: CreditCard,
      action: () => {
        router.push('/cards');
        onClose();
      },
    },
    {
      id: 'nav-fixed-debts',
      category: 'Navegação',
      title: 'Mensalidades, Contas & Dívidas',
      subtitle: 'Contas recorrentes, cronograma semanal e parcelamentos',
      icon: Repeat,
      action: () => {
        router.push('/fixed-debts');
        onClose();
      },
    },
    {
      id: 'nav-goals',
      category: 'Navegação',
      title: 'Metas Financeiras',
      subtitle: 'Economia, reservas e objetivos',
      icon: Target,
      action: () => {
        router.push('/goals');
        onClose();
      },
    },
    {
      id: 'nav-transactions',
      category: 'Navegação',
      title: 'Extrato Geral de Transações',
      subtitle: 'Tabela completa com filtros',
      icon: ReceiptText,
      action: () => {
        router.push('/transactions');
        onClose();
      },
    },
    {
      id: 'nav-import',
      category: 'Navegação',
      title: 'Importar Extratos (OFX & CSV)',
      subtitle: 'Upload de faturas Nubank ou extratos bancários universais',
      icon: FileSpreadsheet,
      action: () => {
        router.push('/import');
        onClose();
      },
    },
    {
      id: 'nav-settings',
      category: 'Navegação',
      title: 'Configurações & Perfil',
      subtitle: 'Ciclo de renda, modo privacidade e backup',
      icon: Settings,
      action: () => {
        router.push('/settings');
        onClose();
      },
    },
  ];

  // Filtra itens com base na busca
  const filteredCommands = commands.filter((cmd) => {
    const q = query.toLowerCase().trim();
    if (!q) return true;
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q)) ||
      cmd.category.toLowerCase().includes(q)
    );
  });

  // Foco no input ao abrir
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Navegação por teclado
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev + 1) % (filteredCommands.length || 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % (filteredCommands.length || 1));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const selected = filteredCommands[selectedIndex];
        if (selected) {
          selected.action();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-16 sm:pt-24 px-4 bg-background/80 backdrop-blur-md">
      <div 
        className="fixed inset-0" 
        onClick={onClose} 
        aria-hidden="true" 
      />

      <div className="relative w-full max-w-xl bg-card border border-border shadow-2xl rounded-2xl overflow-hidden z-10 flex flex-col max-h-[80vh] animate-in fade-in zoom-in-95 duration-150">
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/80 bg-secondary/30">
          <Search className="w-5 h-5 text-emerald-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSelectedIndex(0);
            }}
            placeholder="O que você deseja fazer ou encontrar? (ex: Despesa, Metas, Nubank)..."
            className="w-full bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button
              onClick={() => setQuery('')}
              className="p-1 rounded-md text-muted-foreground hover:text-foreground"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <span className="hidden sm:inline-block text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground border border-border">
            ESC
          </span>
        </div>

        {/* Results List */}
        <div className="overflow-y-auto p-2 divide-y divide-border/30">
          {filteredCommands.length === 0 ? (
            <div className="p-8 text-center text-xs text-muted-foreground">
              Nenhum comando ou página encontrada para &quot;{query}&quot;.
            </div>
          ) : (
            filteredCommands.map((cmd, idx) => {
              const Icon = cmd.icon;
              const isSelected = idx === selectedIndex;

              return (
                <div
                  key={cmd.id}
                  onClick={() => cmd.action()}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-colors ${
                    isSelected ? 'bg-primary/10 text-primary' : 'hover:bg-secondary/60 text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        isSelected ? 'bg-primary/20 text-primary' : 'bg-secondary text-muted-foreground'
                      }`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="text-xs font-semibold truncate leading-tight">
                        {cmd.title}
                      </span>
                      {cmd.subtitle && (
                        <span className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                          {cmd.subtitle}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-secondary/80 text-muted-foreground/80 border border-border/50">
                      {cmd.category}
                    </span>
                    {cmd.shortcut && (
                      <kbd className="hidden sm:inline-block text-[10px] font-mono px-1.5 py-0.5 rounded bg-card border border-border text-foreground font-bold">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Bottom Help Footer */}
        <div className="px-4 py-2 bg-secondary/40 border-t border-border/60 flex items-center justify-between text-[11px] text-muted-foreground">
          <div className="flex items-center gap-3">
            <span><kbd className="font-mono bg-card px-1 py-0.5 rounded border border-border">↑↓</kbd> navegar</span>
            <span><kbd className="font-mono bg-card px-1 py-0.5 rounded border border-border">ENTER</kbd> selecionar</span>
          </div>
          <span className="text-emerald-400 font-medium">ArrumaBolso Quick Command</span>
        </div>
      </div>
    </div>
  );
}
