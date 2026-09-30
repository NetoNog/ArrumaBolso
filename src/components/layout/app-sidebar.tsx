'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { 
  LayoutDashboard, 
  ReceiptText, 
  FileSpreadsheet, 
  Target, 
  Database, 
  WalletCards, 
  Sparkles,
  CreditCard,
  TrendingUp,
  CircleDollarSign,
  Plus,
  Cloud,
  Edit2,
  LogOut,
  ArrowUpRight,
  ArrowDownRight,
  Repeat,
  Settings
} from 'lucide-react';
import { toast } from 'sonner';
import { formatCurrency } from '@/lib/financial/formatters';
import { AccountAndCard } from '@/lib/supabase/types';
import { useAccounts, useProfile, useAddAccount, useUpdateAccount, useDeleteAccount } from '@/hooks/use-financial';
import { isSupabaseConfigured } from '@/lib/supabase/client';
import { AccountModal } from '@/components/accounts/account-modal';
import { AuthModal } from '@/components/auth/auth-modal';
import { FinancialService } from '@/lib/services/financial-service';

import { BrandLogo } from '@/components/ui/brand-logo';
import { UserAvatar } from '@/components/ui/user-avatar';
import { usePrivacy } from '@/components/providers/privacy-provider';

interface AppSidebarProps {
  accounts?: AccountAndCard[];
}

export function AppSidebar({ accounts: initialAccounts }: AppSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { formatMoney } = usePrivacy();
  const { data: accounts = initialAccounts || [] } = useAccounts();
  const { data: profile } = useProfile();
  
  const addAccountMutation = useAddAccount();
  const updateAccountMutation = useUpdateAccount();
  const deleteAccountMutation = useDeleteAccount();

  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false);
  const [accountToEdit, setAccountToEdit] = useState<AccountAndCard | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const isCloud = isSupabaseConfigured();

  useEffect(() => {
    async function checkAuth() {
      const session = await FinancialService.getCurrentSession();
      if (session) {
        setCurrentUser(session.user);
      } else if (isCloud) {
        const u = await FinancialService.getCurrentUser();
        setCurrentUser(u);
      }
    }
    checkAuth();
  }, [isCloud]);

  const handleLogout = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await FinancialService.signOut();
    toast.success('Sessão encerrada com sucesso.');
    router.push('/login');
  };

  const isAdmin = currentUser?.role === 'admin';

  const navigation = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Receitas (Entradas)', href: '/incomes', icon: ArrowUpRight },
    { name: 'Despesas (Saídas)', href: '/expenses', icon: ArrowDownRight },
    { name: 'Cartões de Crédito', href: '/cards', icon: CreditCard },
    { name: 'Mensalidades & Dívidas', href: '/fixed-debts', icon: Repeat },
    { name: 'Metas Financeiras', href: '/goals', icon: Target },
    { name: 'Extrato Geral', href: '/transactions', icon: ReceiptText },
    { name: 'Importar Extratos', href: '/import', icon: FileSpreadsheet, badge: 'OFX/CSV' },
    { name: 'Configurações', href: '/settings', icon: Settings },
    ...(isAdmin ? [
      { name: 'Gestão de Contas', href: '/admin', icon: Sparkles, badge: 'Admin' },
      { name: 'Banco Supabase & DDL', href: '/database', icon: Database, badge: 'Dev' }
    ] : [])
  ];

  const totalConsolidated = accounts.reduce((sum, a) => sum + Number(a.balance), 0);

  const initials = profile?.full_name 
    ? profile.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
    : 'AB';

  return (
    <>
      <aside className="w-56 lg:w-64 shrink-0 border-r border-border/70 bg-card/40 backdrop-blur-md flex flex-col justify-between h-screen sticky top-0 z-30 transition-all duration-300 hidden md:flex">
        <div>
          {/* Brand Header */}
          <div className="h-16 px-4 border-b border-border/70 flex items-center justify-between">
            <Link href="/" className="flex items-center group">
              <BrandLogo size="md" tagline="Suas finanças nos trinques" />
            </Link>
          </div>

          {/* Navigation Links */}
          <div className="px-3 py-4 space-y-1">
            <div className="px-3 pb-2 text-[10px] font-bold text-muted-foreground/70 uppercase tracking-wider">
              Menu
            </div>
            {navigation.map((item) => {
              const isActive = pathname === item.href;
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all group ${
                    isActive
                      ? 'bg-primary/10 text-primary font-semibold border border-primary/20 shadow-sm'
                      : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 transition-colors ${isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.badge && (
                    <span className="text-[10px] uppercase font-semibold tracking-wider px-1.5 py-0.2 rounded bg-secondary text-muted-foreground border border-border">
                      {item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Real Accounts Summary with Add Button */}
          <div className="px-3.5 py-3 mx-3 mt-1 rounded-xl bg-secondary/30 border border-border/70">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <WalletCards className="w-3.5 h-3.5 text-muted-foreground" />
                Contas & Cartões
              </span>
              <button
                type="button"
                onClick={() => {
                  setAccountToEdit(null);
                  setIsAccountModalOpen(true);
                }}
                className="p-1 rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                title="Adicionar Nova Conta ou Cartão"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="space-y-1 mt-1 max-h-48 overflow-y-auto pr-1">
              {accounts.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic py-1">
                  Nenhuma conta cadastrada.{' '}
                  <button
                    onClick={() => {
                      setAccountToEdit(null);
                      setIsAccountModalOpen(true);
                    }}
                    className="text-primary underline font-medium"
                  >
                    Adicionar
                  </button>
                </div>
              ) : (
                accounts.map((acc) => {
                  const isCard = acc.type === 'credit_card';
                  const isInvestment = acc.type === 'investment';
                  const isNegative = Number(acc.balance) < 0;

                  return (
                    <div
                      key={acc.id}
                      onClick={() => {
                        setAccountToEdit(acc);
                        setIsAccountModalOpen(true);
                      }}
                      className="flex items-center justify-between text-xs p-1.5 rounded-lg hover:bg-secondary/70 cursor-pointer group transition-colors"
                      title="Clique para editar esta conta"
                    >
                      <span className="text-muted-foreground group-hover:text-foreground flex items-center gap-1.5 truncate max-w-[110px]">
                        {isCard ? (
                          <CreditCard className="w-3 h-3 text-muted-foreground shrink-0" />
                        ) : isInvestment ? (
                          <TrendingUp className="w-3 h-3 text-amber-500 shrink-0" />
                        ) : (
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: acc.color || '#6366f1' }} />
                        )}
                        <span className="truncate">{acc.name}</span>
                      </span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <span className={`font-semibold tabular-nums ${
                          isNegative ? 'text-destructive' : Number(acc.balance) > 0 ? 'text-foreground' : 'text-muted-foreground'
                        }`}>
                          {formatMoney(acc.balance)}
                        </span>
                        <Edit2 className="w-2.5 h-2.5 opacity-0 group-hover:opacity-60 text-muted-foreground" />
                      </div>
                    </div>
                  );
                })
              )}

              <div className="pt-2 border-t border-border/60 flex items-center justify-between text-[11px] font-bold">
                <span className="text-muted-foreground">Saldo Total:</span>
                <span className={`tabular-nums ${totalConsolidated >= 0 ? 'text-foreground' : 'text-destructive'}`}>
                  {formatMoney(totalConsolidated)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Profile / Sync Widget */}
        <div className="p-3 border-t border-border/70">
          <div
            onClick={() => setIsAuthModalOpen(true)}
            className="flex items-center justify-between p-2.5 rounded-xl bg-secondary/30 border border-border/70 hover:bg-secondary/60 hover:border-border cursor-pointer transition-colors group"
            title="Clique para editar seu perfil ou gerenciar sua conta"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <UserAvatar
                avatarUrl={profile?.avatar_url}
                name={currentUser?.full_name || profile?.full_name}
                email={currentUser?.email || profile?.email}
                size="sm"
                className="group-hover:scale-105 transition-transform"
              />
              <div className="flex flex-col min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground truncate max-w-[95px]">
                    {currentUser?.full_name?.split(' ')[0] || profile?.full_name?.split(' ')[0] || currentUser?.email?.split('@')[0] || 'Usuário'}
                  </span>
                  {isAdmin ? (
                    <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">
                      ADMIN
                    </span>
                  ) : null}
                </div>
                <span className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5 group-hover:text-primary transition-colors">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                  <span>Editar Perfil</span>
                </span>
              </div>
            </div>

            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsAuthModalOpen(true);
                }}
                title="Editar Perfil e Avatar"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={handleLogout}
                title="Sair da Conta (Logoff)"
                className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Account Modal */}
      <AccountModal
        isOpen={isAccountModalOpen}
        onClose={() => setIsAccountModalOpen(false)}
        accountToEdit={accountToEdit}
        onSave={async (accData, id) => {
          if (id) {
            await updateAccountMutation.mutateAsync({ ...accData, id });
          } else {
            await addAccountMutation.mutateAsync(accData);
          }
        }}
        onDelete={async (id) => {
          await deleteAccountMutation.mutateAsync(id);
        }}
      />

      {/* Supabase Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onAuthSuccess={async () => {
          const u = await FinancialService.getCurrentUser();
          setCurrentUser(u);
        }}
      />
    </>
  );
}
