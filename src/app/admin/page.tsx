'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppSidebar } from '@/components/layout/app-sidebar';
import { AppHeader } from '@/components/layout/app-header';
import { MobileBottomNav } from '@/components/layout/mobile-bottom-nav';
import { FinancialService, SystemUser, AuthSession } from '@/lib/services/financial-service';
import { UserRole, UserAccountStatus } from '@/lib/supabase/types';
import { formatCurrency } from '@/lib/financial/formatters';
import { maskCurrency, parseCurrency } from '@/lib/financial/currency-mask';
import { 
  Users, 
  ShieldCheck, 
  UserPlus, 
  Search, 
  CheckCircle2, 
  AlertCircle, 
  Lock, 
  Trash2, 
  Key, 
  Sparkles, 
  UserX, 
  UserCheck, 
  ShieldAlert,
  ArrowRight,
  Clock,
  Mail,
  User,
  X,
  Plus
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function AdminPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<AuthSession['user'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserAccountStatus>('all');
  const [roleFilter, setRoleFilter] = useState<'all' | UserRole>('all');

  // Modal Novo Usuário
  const [isNewUserModalOpen, setIsNewUserModalOpen] = useState(false);
  const [newFullName, setNewFullName] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<UserRole>('user');
  const [newStatus, setNewStatus] = useState<UserAccountStatus>('active');
  const [newIncome, setNewIncome] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal Redefinir Senha
  const [selectedUserForPassword, setSelectedUserForPassword] = useState<SystemUser | null>(null);
  const [resetPasswordValue, setResetPasswordValue] = useState('');

  // 1. Verificação de permissões do usuário logado
  useEffect(() => {
    async function checkAdminAuth() {
      try {
        const session = await FinancialService.getCurrentSession();
        if (!session) {
          router.replace('/login');
          return;
        }

        if (session.user.role !== 'admin') {
          toast.error('Acesso negado: apenas administradores podem acessar a gestão de contas.');
          router.replace('/');
          return;
        }

        setCurrentUser(session.user);
        await loadUsers();
      } catch (err) {
        toast.error('Erro ao verificar permissões de administrador.');
        router.replace('/');
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminAuth();
  }, [router]);

  const loadUsers = async () => {
    try {
      const list = await FinancialService.getSystemUsers();
      setUsers(list);
    } catch (err: any) {
      toast.error('Erro ao carregar lista de usuários.');
    }
  };

  // Filtragem
  const filteredUsers = users.filter(u => {
    const matchesSearch = 
      u.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesStatus = statusFilter === 'all' || u.status === statusFilter;
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesStatus && matchesRole;
  });

  // Métricas
  const totalUsers = users.length;
  const activeUsers = users.filter(u => u.status === 'active').length;
  const pendingUsers = users.filter(u => u.status === 'pending').length;
  const adminUsers = users.filter(u => u.role === 'admin').length;

  // Ações de Gestão
  const handleToggleStatus = async (user: SystemUser, newStatus: UserAccountStatus) => {
    try {
      await FinancialService.toggleUserStatus(user.id, newStatus);
      toast.success(`Status de ${user.full_name} alterado para "${newStatus}".`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao alterar status do usuário.');
    }
  };

  const handleToggleRole = async (user: SystemUser) => {
    const newRole: UserRole = user.role === 'admin' ? 'user' : 'admin';
    try {
      await FinancialService.toggleUserRole(user.id, newRole);
      toast.success(`Cargo de ${user.full_name} alterado para "${newRole === 'admin' ? 'Administrador' : 'Usuário Padrão'}".`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao alterar cargo do usuário.');
    }
  };

  const handleDeleteUser = async (user: SystemUser) => {
    if (!confirm(`Deseja realmente excluir a conta de ${user.full_name} (${user.email})? Todos os seus dados financeiros isolados serão permanentemente apagados.`)) {
      return;
    }

    try {
      await FinancialService.deleteSystemUser(user.id);
      toast.success(`Usuário ${user.full_name} excluído com sucesso.`);
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Erro ao excluir usuário.');
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim() || !newEmail.trim() || !newPassword) {
      toast.error('Preencha os campos obrigatórios (Nome, Email e Senha).');
      return;
    }
    if (newPassword.length < 6) {
      toast.error('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    try {
      setIsSubmitting(true);
      await FinancialService.createSystemUser({
        full_name: newFullName.trim(),
        email: newEmail.trim().toLowerCase(),
        password: newPassword,
        role: newRole,
        status: newStatus,
        base_monthly_income: parseCurrency(newIncome)
      });

      toast.success(`Usuário ${newFullName} cadastrado com sucesso!`);
      setIsNewUserModalOpen(false);
      setNewFullName('');
      setNewEmail('');
      setNewPassword('');
      setNewIncome('');
      await loadUsers();
    } catch (err: any) {
      toast.error(err.message || 'Falha ao cadastrar usuário.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUserForPassword || !resetPasswordValue || resetPasswordValue.length < 6) {
      toast.error('Informe uma senha válida com pelo menos 6 caracteres.');
      return;
    }

    try {
      await FinancialService.resetUserPassword(selectedUserForPassword.id, resetPasswordValue);
      toast.success(`Senha de ${selectedUserForPassword.full_name} atualizada com sucesso!`);
      setSelectedUserForPassword(null);
      setResetPasswordValue('');
    } catch (err: any) {
      toast.error(err.message || 'Erro ao redefinir senha.');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-xs text-muted-foreground">Verificando credenciais de Administrador...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground pb-16 md:pb-0">
      <AppSidebar />

      <div className="flex-1 flex flex-col min-w-0">
        <AppHeader />

        <main className="p-4 sm:p-8 space-y-6 max-w-7xl mx-auto w-full">
          {/* Header Title */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
                <ShieldCheck className="w-5 h-5 text-primary shrink-0" />
                Gestão de Usuários & Acessos
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Controle de permissões, aprovações e isolamento de dados entre contas.
              </p>
            </div>

            <button
              onClick={() => setIsNewUserModalOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-medium transition-colors shadow-sm self-start sm:self-auto"
            >
              <UserPlus className="w-4 h-4" />
              Novo Usuário
            </button>
          </div>

          {/* KPI Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Total de Usuários</span>
                <Users className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="text-2xl font-semibold tracking-tight text-foreground mt-2 tabular-nums">{totalUsers}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Cadastrados no sistema</p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Contas Ativas</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-semibold tracking-tight text-emerald-600 dark:text-emerald-400 mt-2 tabular-nums">{activeUsers}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Com acesso liberado</p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Pendentes</span>
                <Clock className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-semibold tracking-tight text-amber-600 dark:text-amber-400 mt-2 tabular-nums">{pendingUsers}</div>
              <p className="text-[11px] text-muted-foreground mt-1">
                {pendingUsers > 0 ? 'Aguardando liberação' : 'Nenhuma pendência'}
              </p>
            </div>

            <div className="p-4 rounded-xl bg-card border border-border shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-xs font-medium text-muted-foreground">Administradores</span>
                <ShieldAlert className="w-4 h-4 text-primary" />
              </div>
              <div className="text-2xl font-semibold tracking-tight text-foreground mt-2 tabular-nums">{adminUsers}</div>
              <p className="text-[11px] text-muted-foreground mt-1">Com acesso total</p>
            </div>
          </div>

          {/* Notice & Security Assurance Card */}
          <div className="p-3.5 rounded-xl bg-secondary/40 border border-border/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="w-4 h-4 text-primary shrink-0" />
              <div>
                <span className="font-medium text-foreground">Isolamento Multi-Tenant Garantido:</span>{' '}
                <span className="text-muted-foreground">
                  Cada usuário possui chave de escopo exclusiva. Registros financeiros e contas bancárias são totalmente confidenciais.
                </span>
              </div>
            </div>
            <div className="text-[11px] font-medium text-muted-foreground shrink-0 bg-background px-2.5 py-1 rounded-md border border-border">
              Admin: {currentUser?.email}
            </div>
          </div>

          {/* Search and Filters Bar */}
          <div className="p-3 rounded-xl bg-card border border-border shadow-sm flex flex-col md:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Buscar por nome ou email..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-secondary/50 text-foreground text-xs pl-9 pr-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary"
              />
            </div>

            <div className="flex items-center gap-2 w-full md:w-auto">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as any)}
                className="w-full md:w-auto bg-secondary/50 text-foreground text-xs rounded-lg px-3 py-2 border border-border focus:outline-none"
              >
                <option value="all">Todos os Status</option>
                <option value="active">Apenas Ativos</option>
                <option value="pending">Apenas Pendentes</option>
                <option value="blocked">Apenas Bloqueados</option>
              </select>

              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as any)}
                className="w-full md:w-auto bg-secondary/50 text-foreground text-xs rounded-lg px-3 py-2 border border-border focus:outline-none"
              >
                <option value="all">Todos os Cargos</option>
                <option value="admin">Administradores</option>
                <option value="user">Usuários Padrão</option>
              </select>
            </div>
          </div>

          {/* Users Management Table */}
          <div className="rounded-xl bg-card border border-border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-secondary/40 border-b border-border text-muted-foreground font-medium text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Usuário</th>
                    <th className="py-3 px-4">Cargo</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Dados</th>
                    <th className="py-3 px-4">Cadastro</th>
                    <th className="py-3 px-4 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-muted-foreground">
                        Nenhum usuário encontrado com os filtros selecionados.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isMasterAdmin = user.id === 'usr_admin_master';
                      const initials = user.full_name
                        ? user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()
                        : 'US';

                      return (
                        <tr key={user.id} className="hover:bg-secondary/20 transition-colors">
                          {/* Nome & Email */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-7 h-7 rounded-full bg-secondary text-foreground border border-border flex items-center justify-center font-medium text-xs shrink-0">
                                {initials}
                              </div>
                              <div>
                                <div className="font-medium text-foreground flex items-center gap-1.5">
                                  {user.full_name}
                                  {isMasterAdmin && (
                                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-foreground border border-border font-medium">
                                      MASTER
                                    </span>
                                  )}
                                </div>
                                <div className="text-muted-foreground text-[11px]">{user.email}</div>
                              </div>
                            </div>
                          </td>

                          {/* Cargo */}
                          <td className="py-3 px-4">
                            {user.role === 'admin' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-primary/10 text-primary border border-primary/20">
                                <ShieldCheck className="w-3 h-3" />
                                Admin
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-normal bg-secondary text-muted-foreground border border-border">
                                Usuário
                              </span>
                            )}
                          </td>

                          {/* Status */}
                          <td className="py-3 px-4">
                            {user.status === 'active' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                <CheckCircle2 className="w-3 h-3" />
                                Ativo
                              </span>
                            ) : user.status === 'pending' ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                <Clock className="w-3 h-3" />
                                Pendente
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                <UserX className="w-3 h-3" />
                                Bloqueado
                              </span>
                            )}
                          </td>

                          {/* Contadores Isolados */}
                          <td className="py-3 px-4 text-muted-foreground tabular-nums">
                            <span className="font-medium text-foreground">{user.transactions_count || 0}</span> txs &middot;{' '}
                            <span className="font-medium text-foreground">{user.accounts_count || 0}</span> contas
                          </td>

                          {/* Data */}
                          <td className="py-3 px-4 text-muted-foreground tabular-nums">
                            {user.created_at ? format(new Date(user.created_at), 'dd/MM/yyyy') : '-'}
                          </td>

                          {/* Ações */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              {/* Aprovar (se pendente) */}
                              {user.status === 'pending' && (
                                <button
                                  onClick={() => handleToggleStatus(user, 'active')}
                                  className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-medium transition-colors"
                                  title="Aprovar e Liberar Acesso"
                                >
                                  <UserCheck className="w-3 h-3" />
                                  Aprovar
                                </button>
                              )}

                              {/* Bloquear / Desbloquear */}
                              {!isMasterAdmin && (
                                <button
                                  onClick={() => handleToggleStatus(user, user.status === 'blocked' ? 'active' : 'blocked')}
                                  className={`p-1.5 rounded-md border transition-colors ${
                                    user.status === 'blocked'
                                      ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/30 hover:bg-emerald-500/20'
                                      : 'bg-secondary/50 text-muted-foreground border-border hover:text-rose-500 hover:border-rose-500/30'
                                  }`}
                                  title={user.status === 'blocked' ? 'Desbloquear usuário' : 'Bloquear usuário'}
                                >
                                  {user.status === 'blocked' ? <UserCheck className="w-3.5 h-3.5" /> : <UserX className="w-3.5 h-3.5" />}
                                </button>
                              )}

                              {/* Alternar Cargo (Promover / Rebaixar) */}
                              {!isMasterAdmin && (
                                <button
                                  onClick={() => handleToggleRole(user)}
                                  className="p-1.5 rounded-md bg-secondary/50 text-muted-foreground hover:text-foreground border border-border transition-colors"
                                  title={user.role === 'admin' ? 'Tornar Usuário Comum' : 'Promover a Administrador'}
                                >
                                  <ShieldCheck className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {/* Redefinir Senha */}
                              <button
                                onClick={() => setSelectedUserForPassword(user)}
                                className="p-1.5 rounded-md bg-secondary/50 text-muted-foreground hover:text-foreground border border-border transition-colors"
                                title="Redefinir Senha"
                              >
                                <Key className="w-3.5 h-3.5" />
                              </button>

                              {/* Excluir Conta */}
                              {!isMasterAdmin && (
                                <button
                                  onClick={() => handleDeleteUser(user)}
                                  className="p-1.5 rounded-md bg-secondary/50 text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 border border-border transition-colors"
                                  title="Excluir Conta Permanentemente"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>

      </div>

      {/* Modal: Novo Usuário */}
      {isNewUserModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="bg-card border border-border rounded-xl w-full max-w-md shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Cadastrar Novo Usuário</h3>
              </div>
              <button
                onClick={() => setIsNewUserModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="p-5 space-y-3.5">
              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Nome Completo</label>
                <input
                  type="text"
                  placeholder="Ex: Carlos Eduardo Silva"
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  className="w-full bg-secondary/50 text-foreground text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Email</label>
                <input
                  type="email"
                  placeholder="exemplo@gestaofinanceira.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  className="w-full bg-secondary/50 text-foreground text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Senha Inicial (mínimo 6 dígitos)</label>
                <input
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full bg-secondary/50 text-foreground text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Cargo</label>
                  <select
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value as UserRole)}
                    className="w-full bg-secondary/50 text-foreground text-xs px-3 py-2 rounded-lg border border-border focus:outline-none"
                  >
                    <option value="user">Usuário Padrão</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-medium text-foreground mb-1 block">Status</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as UserAccountStatus)}
                    className="w-full bg-secondary/50 text-foreground text-xs px-3 py-2 rounded-lg border border-border focus:outline-none"
                  >
                    <option value="active">Ativo (Liberado)</option>
                    <option value="pending">Pendente</option>
                    <option value="blocked">Bloqueado</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-foreground mb-1 block">Renda Mensal Estimada (Opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-xs font-bold text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="0,00"
                    value={newIncome}
                    onChange={(e) => setNewIncome((prev) => maskCurrency(e.target.value, prev))}
                    className="w-full bg-secondary/50 text-foreground text-xs pl-9 pr-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary font-mono tabular-nums"
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewUserModalOpen(false)}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-3.5 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                >
                  {isSubmitting ? 'Cadastrando...' : 'Criar Conta'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Redefinir Senha */}
      {selectedUserForPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm animate-in fade-in-0">
          <div className="bg-card border border-border rounded-xl w-full max-w-sm shadow-lg overflow-hidden">
            <div className="px-5 py-4 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Key className="w-4 h-4 text-primary" />
                <h3 className="font-semibold text-sm text-foreground">Redefinir Senha</h3>
              </div>
              <button
                onClick={() => setSelectedUserForPassword(null)}
                className="text-muted-foreground hover:text-foreground p-1 rounded-md hover:bg-secondary transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleResetPassword} className="p-5 space-y-3.5">
              <p className="text-xs text-muted-foreground">
                Defina uma nova senha de acesso para <strong className="text-foreground">{selectedUserForPassword.full_name}</strong> ({selectedUserForPassword.email}):
              </p>

              <div>
                <input
                  type="password"
                  placeholder="Nova senha (mínimo 6 caracteres)"
                  value={resetPasswordValue}
                  onChange={(e) => setResetPasswordValue(e.target.value)}
                  className="w-full bg-secondary/50 text-foreground text-xs px-3 py-2 rounded-lg border border-border focus:outline-none focus:border-primary"
                  autoFocus
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedUserForPassword(null)}
                  className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 text-xs font-medium text-primary-foreground bg-primary hover:bg-primary/90 rounded-lg transition-colors"
                >
                  Salvar Senha
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
