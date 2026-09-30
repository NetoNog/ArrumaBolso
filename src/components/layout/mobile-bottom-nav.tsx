'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  ArrowUpRight, 
  ArrowDownRight, 
  Target, 
  ReceiptText,
  Repeat,
  Plus,
  X,
  UploadCloud,
  CreditCard
} from 'lucide-react';

interface MobileBottomNavProps {
  onOpenNewTransaction?: (type?: 'expense' | 'income') => void;
}

export function MobileBottomNav({ onOpenNewTransaction }: MobileBottomNavProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isQuickActionsOpen, setIsQuickActionsOpen] = useState(false);

  const leftLinks = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Receitas', href: '/incomes', icon: ArrowUpRight },
  ];

  const rightLinks = [
    { name: 'Despesas', href: '/expenses', icon: ArrowDownRight },
    { name: 'Extrato', href: '/transactions', icon: ReceiptText },
  ];

  const handleAction = (type: 'expense' | 'income') => {
    setIsQuickActionsOpen(false);
    if (onOpenNewTransaction) {
      onOpenNewTransaction(type);
    } else {
      router.push(type === 'income' ? '/incomes' : '/expenses');
    }
  };

  return (
    <>
      {/* Quick Action Bottom Sheet Overlay */}
      {isQuickActionsOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-xs z-40 animate-in fade-in duration-150"
          onClick={() => setIsQuickActionsOpen(false)}
        />
      )}

      {/* Quick Action Bottom Sheet Drawer */}
      {isQuickActionsOpen && (
        <div className="md:hidden fixed inset-x-0 bottom-16 z-50 bg-card/98 backdrop-blur-xl border-t border-border rounded-t-3xl p-5 shadow-2xl safe-area-pb animate-in slide-in-from-bottom-6 duration-200">
          <div className="w-10 h-1 bg-border/80 rounded-full mx-auto mb-4" />
          
          <div className="flex items-center justify-between mb-3 px-1">
            <h3 className="text-sm font-bold text-foreground">Ação Rápida</h3>
            <span className="text-[11px] text-muted-foreground">Escolha o que deseja registrar</span>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            {/* Nova Despesa */}
            <button
              onClick={() => handleAction('expense')}
              className="p-3 rounded-2xl bg-rose-500/10 hover:bg-rose-500/15 border border-rose-500/25 flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-rose-500/20 text-rose-400 flex items-center justify-center">
                <ArrowDownRight className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-rose-400 block">Nova Despesa</span>
                <span className="text-[10px] text-muted-foreground">Saída, conta ou compra</span>
              </div>
            </button>

            {/* Nova Receita */}
            <button
              onClick={() => handleAction('income')}
              className="p-3 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/15 border border-emerald-500/25 flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                <ArrowUpRight className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-emerald-400 block">Nova Receita</span>
                <span className="text-[10px] text-muted-foreground">Entrada, salário ou Pix</span>
              </div>
            </button>

            {/* Importar Extrato */}
            <Link
              href="/import"
              onClick={() => setIsQuickActionsOpen(false)}
              className="p-3 rounded-2xl bg-secondary/50 hover:bg-secondary border border-border/80 flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <UploadCloud className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-foreground block">Importar Extrato</span>
                <span className="text-[10px] text-muted-foreground">Subir CSV ou OFX</span>
              </div>
            </Link>

            {/* Cartões de Crédito */}
            <Link
              href="/cards"
              onClick={() => setIsQuickActionsOpen(false)}
              className="p-3 rounded-2xl bg-secondary/50 hover:bg-secondary border border-border/80 flex flex-col items-start gap-2 text-left transition-all active:scale-[0.98]"
            >
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs text-foreground block">Ver Cartões</span>
                <span className="text-[10px] text-muted-foreground">Faturas e limites</span>
              </div>
            </Link>
          </div>
        </div>
      )}

      {/* Fixed Bottom Navigation Bar */}
      <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-card/95 backdrop-blur-lg border-t border-border px-3 py-1.5 flex items-center justify-around shadow-2xl safe-area-pb">
        {leftLinks.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}

        {/* Center Floating Quick Action Button */}
        <button
          onClick={() => setIsQuickActionsOpen(!isQuickActionsOpen)}
          className={`w-11 h-11 -mt-5 rounded-full flex items-center justify-center shadow-lg border-2 border-background transition-all active:scale-95 ${
            isQuickActionsOpen 
              ? 'bg-rose-600 text-white rotate-45' 
              : 'bg-primary hover:bg-primary/90 text-primary-foreground'
          }`}
          aria-label={isQuickActionsOpen ? 'Fechar Ações Rápidas' : 'Abrir Ações Rápidas'}
        >
          <Plus className="w-5 h-5 stroke-[2.5] transition-transform duration-200" />
        </button>

        {rightLinks.map((item) => {
          const Icon = item.icon;
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-0.5 text-[10px] font-medium py-1 px-2.5 rounded-lg transition-colors ${
                isActive ? 'text-primary font-bold' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-primary' : 'text-muted-foreground'}`} />
              <span>{item.name}</span>
            </Link>
          );
        })}
      </nav>
    </>
  );
}
