import { supabase, isSupabaseConfigured, getSupabase } from '../supabase/client';
import { 
  Category, 
  AccountAndCard, 
  Transaction, 
  MonthlyBudget, 
  FinancialGoal, 
  FixedExpense,
  Debt,
  Profile,
  UserRole,
  UserAccountStatus
} from '../supabase/types';
import { 
  INITIAL_PROFILE, 
  INITIAL_CATEGORIES, 
  INITIAL_ACCOUNTS, 
  INITIAL_TRANSACTIONS, 
  INITIAL_GOALS, 
  INITIAL_BUDGETS,
  INITIAL_FIXED_EXPENSES,
  INITIAL_DEBTS
} from '../mock-data/initial-data';
import { ParsedNubankItem } from '../parsers/nubank-parser';
import { addMonths, format, parseISO } from 'date-fns';

export interface AuthSession {
  user: {
    id: string;
    email: string;
    full_name: string;
    role: UserRole;
    status: UserAccountStatus;
    created_at: string;
    is_local?: boolean;
  };
  token?: string;
  created_at: string;
}

export interface SystemUser {
  id: string;
  email: string;
  full_name: string;
  password?: string;
  role: UserRole;
  status: UserAccountStatus;
  base_monthly_income?: number;
  created_at: string;
  updated_at?: string;
  transactions_count?: number;
  accounts_count?: number;
}

export interface MigrationResult {
  success: boolean;
  categoriesMigrated: number;
  accountsMigrated: number;
  transactionsMigrated: number;
  budgetsMigrated: number;
  goalsMigrated: number;
  errors: string[];
  localDataWiped: boolean;
}

export function isValidUUID(str?: string | null): boolean {
  if (!str) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

export function createUUID(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0, v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const STORAGE_KEYS = {
  USERS: 'gf_system_users_v3',
  SESSION: 'gf_auth_session',
  SYSTEM_INIT: 'gf_system_initialized_v3',
  DATA_MODE: 'gf_data_mode'
};

function getLocal<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : fallback;
  } catch (err) {
    console.warn(`Erro ao ler chave ${key} do localStorage:`, err);
    return fallback;
  }
}

function setLocal<T>(key: string, value: T): boolean {
  if (typeof window === 'undefined') return false;
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (err: any) {
    console.error(`Erro ao salvar no localStorage para chave ${key}`, err);
    if (err?.name === 'QuotaExceededError' || err?.code === 22) {
      console.error('Limite de armazenamento local (LocalStorage Quota) atingido.');
    }
    return false;
  }
}

export class FinancialService {
  // ==========================================
  // ==========================================
  // MULTI-TENANCY & ESCOPO DE USUÁRIO ISOLADO
  // ==========================================
  private static activeUserIdCache: string = '';
  private static provisionedUsers: Set<string> = new Set<string>();
  private static sessionCache: { session: AuthSession; expiresAt: number } | null = null;
  private static currentSessionPromise: Promise<AuthSession | null> | null = null;
  private static readonly SESSION_CACHE_TTL_MS = 6000; // 6 segundos de cache em memória

  public static setActiveUserId(uid: string) {
    if (isValidUUID(uid)) {
      this.activeUserIdCache = uid;
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('gf_auth_signin', { detail: { userId: uid } }));
      }
    } else {
      this.activeUserIdCache = '';
    }
  }

  public static getActiveUserId(): string {
    if (this.activeUserIdCache && isValidUUID(this.activeUserIdCache)) {
      return this.activeUserIdCache;
    }
    if (typeof window === 'undefined') return '';

    // 1. Tenta recuperar da sessão armazenada na chave oficial
    const session = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
    if (session?.user?.id && isValidUUID(session.user.id)) {
      this.activeUserIdCache = session.user.id;
      return session.user.id;
    }

    // 2. Tenta recuperar do token nativo do Supabase Auth no localStorage (sb-*-auth-token)
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
          const raw = localStorage.getItem(key);
          if (raw) {
            const parsed = JSON.parse(raw);
            const tokenUid = parsed?.user?.id || parsed?.currentSession?.user?.id;
            if (tokenUid && isValidUUID(tokenUid)) {
              this.activeUserIdCache = tokenUid;
              return tokenUid;
            }
          }
        }
      }
    } catch {}

    return '';
  }

  private static getUserKey(base: string, userId?: string): string {
    const uid = userId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      return `gf_guest_${base}`;
    }
    return `gf_u_${uid}_${base}`;
  }

  public static isCloudMode(): boolean {
    return isSupabaseConfigured();
  }

  /**
   * Garante provisionamento 100% automático para qualquer conta (Supabase & Local):
   * 1. Perfil criado/sincronizado na tabela 'profiles'
   * 2. Categorias padrão criadas automaticamente (Alimentação, Moradia, Transporte, etc.)
   * 3. Contas bancárias padrão criadas (Conta Corrente, Cartão de Crédito Nubank)
   * 4. Estrutura local isolada inicializada com user_id exclusivo
   * O usuário NÃO precisa abrir SQL Editor, executar DDL ou configurar nada no Supabase.
   */
  public static async ensureUserProvisioned(
    userId: string, 
    email?: string, 
    fullName?: string, 
    baseIncome?: number
  ): Promise<void> {
    if (!userId || !isValidUUID(userId)) return;

    // Cache em memória para evitar verificações repetitivas desnecessárias
    if (this.provisionedUsers.has(userId)) {
      return;
    }

    const cleanEmail = email?.trim().toLowerCase() || '';
    const cleanName = fullName?.trim() || cleanEmail.split('@')[0] || 'Usuário';

    // 1. Auto-provisionamento no Supabase (se conectado)
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          // A. Garante Perfil (profiles)
          const { data: existingProfile } = await client
            .from('profiles')
            .select('id, full_name, role, status')
            .eq('id', userId)
            .maybeSingle();

          if (!existingProfile) {
            await client.from('profiles').upsert({
              id: userId,
              email: cleanEmail,
              full_name: cleanName,
              base_monthly_income: baseIncome || 0,
              role: 'user',
              status: 'active',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });
          }

          // B. Garante Categorias Padrão (categories)
          const { data: existingCats, error: catErr } = await client
            .from('categories')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

          if (!catErr && (!existingCats || existingCats.length === 0)) {
            const initialCats = INITIAL_CATEGORIES.map(c => ({
              id: createUUID(),
              user_id: userId,
              name: c.name,
              slug: c.slug,
              icon: c.icon,
              color: c.color,
              type: c.type,
              is_system: false,
              monthly_budget_cap: c.monthly_budget_cap || 0
            }));
            await client.from('categories').insert(initialCats);
          }

          // C. Garante Contas e Cartões Padrão (accounts_and_cards) com saldo inicial 0.00
          const { data: existingAccs, error: accErr } = await client
            .from('accounts_and_cards')
            .select('id')
            .eq('user_id', userId)
            .limit(1);

          if (!accErr && (!existingAccs || existingAccs.length === 0)) {
            const initialAccs = INITIAL_ACCOUNTS.map(a => ({
              id: createUUID(),
              user_id: userId,
              name: a.name,
              type: a.type,
              institution: a.institution,
              balance: 0.00,
              credit_limit: a.credit_limit || 0.00,
              closing_day: a.closing_day || null,
              due_day: a.due_day || null,
              color: a.color,
              icon: a.icon,
              is_active: true
            }));
            await client.from('accounts_and_cards').insert(initialAccs);
          }
        } catch (err) {
          console.warn('Auto-provisionamento no Supabase tolerou advertência:', err);
        }
      }
    }

    // 2. Garante armazenamento local isolado para o usuário (fallback ou offline)
    this.initUserStore(userId, {
      email: cleanEmail,
      full_name: cleanName,
      base_income: baseIncome || 0,
      role: 'user',
      status: 'active'
    });

    this.provisionedUsers.add(userId);
  }

  /**
   * Inicializa o armazenamento isolado de um usuário específico (modo local/offline)
   */
  public static initUserStore(userId: string, initialData?: { 
    email?: string; 
    full_name?: string; 
    base_income?: number; 
    role?: UserRole; 
    status?: UserAccountStatus 
  }) {
    if (typeof window === 'undefined' || !userId || !isValidUUID(userId)) return;

    const initKey = this.getUserKey('initialized', userId);
    if (!localStorage.getItem(initKey)) {
      const profile: Profile = {
        ...INITIAL_PROFILE,
        id: userId,
        email: initialData?.email || '',
        full_name: initialData?.full_name || 'Usuário',
        base_monthly_income: initialData?.base_income || 0,
        role: initialData?.role || 'user',
        status: initialData?.status || 'active',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const cats = INITIAL_CATEGORIES.map(c => ({ 
        ...c, 
        id: `cat_${userId.substring(0, 6)}_${c.id}`, 
        user_id: userId 
      }));

      const accs = INITIAL_ACCOUNTS.map(a => ({ 
        ...a, 
        id: `acc_${userId.substring(0, 6)}_${a.id}`, 
        user_id: userId,
        balance: 0.00
      }));

      setLocal(this.getUserKey('profile', userId), profile);
      setLocal(this.getUserKey('categories', userId), cats);
      setLocal(this.getUserKey('accounts', userId), accs);
      setLocal(this.getUserKey('transactions', userId), []);
      setLocal(this.getUserKey('goals', userId), []);
      setLocal(this.getUserKey('budgets', userId), []);
      setLocal(this.getUserKey('fixed_expenses', userId), []);
      setLocal(this.getUserKey('debts', userId), []);
      setLocal(initKey, 'true');
    }
  }

  /**
   * Limpa sessões locais residuais inválidas ou mocks antigos
   */
  public static initLocalStore() {
    if (typeof window === 'undefined') return;

    // Purga qualquer sessão local que não seja um UUID válido do Supabase
    try {
      const existingSession = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
      if (existingSession && (!existingSession.user?.id || !isValidUUID(existingSession.user.id) || existingSession.user.is_local)) {
        localStorage.removeItem(STORAGE_KEYS.SESSION);
      }
    } catch {
      // ignore
    }
  }

  // ==========================================
  // PERFIL (ISOLADO POR CONTA)
  // ==========================================
  static async getProfile(targetUserId?: string): Promise<Profile> {
    const uid = targetUserId || this.getActiveUserId();
    if (isSupabaseConfigured() && isValidUUID(uid)) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client.from('profiles').select('*').eq('id', uid).maybeSingle();
        if (!error && data) return data as Profile;

        // Se ainda não existir no profiles, cria para o usuário autenticado
        try {
          const { data: authData } = await client.auth.getUser();
          if (authData?.user && authData.user.id === uid) {
            const fallbackProfile: Partial<Profile> = {
              id: uid,
              email: authData.user.email || '',
              full_name: authData.user.user_metadata?.full_name || authData.user.email?.split('@')[0] || 'Usuário',
              base_monthly_income: Number(authData.user.user_metadata?.base_monthly_income || 0),
              role: 'user',
              status: 'active'
            };
            const { data: created } = await client.from('profiles').upsert(fallbackProfile).select().maybeSingle();
            if (created) return created as Profile;
          }
        } catch {
          // ignore
        }
      }
    }
    return {
      ...INITIAL_PROFILE,
      id: uid || 'user_unknown'
    };
  }

  static async updateProfile(profile: Partial<Profile>, targetUserId?: string): Promise<Profile> {
    const uid = targetUserId || this.getActiveUserId();
    if (isSupabaseConfigured() && isValidUUID(uid)) {
      const client = getSupabase();
      if (client) {
        const nativePayload: any = {
          updated_at: new Date().toISOString()
        };
        if (profile.full_name !== undefined) nativePayload.full_name = profile.full_name;
        if (profile.avatar_url !== undefined) nativePayload.avatar_url = profile.avatar_url;
        if (profile.base_monthly_income !== undefined) nativePayload.base_monthly_income = profile.base_monthly_income;
        if (profile.salary_day !== undefined) nativePayload.salary_day = profile.salary_day;
        if (profile.currency !== undefined) nativePayload.currency = profile.currency;

        try {
          const { data, error } = await client.from('profiles').update(nativePayload).eq('id', uid).select().maybeSingle();
          if (!error && data) {
            client.auth.updateUser({
              data: {
                full_name: profile.full_name,
                avatar_url: profile.avatar_url,
                theme_accent: profile.theme_accent,
                default_privacy_mode: profile.default_privacy_mode,
                hide_cents: profile.hide_cents,
                spending_alert_threshold: profile.spending_alert_threshold,
              }
            }).catch(() => {});
          }
        } catch (e) {
          console.warn('Erro ao atualizar profile no Supabase:', e);
        }
      }
    }
    const current = await this.getProfile(uid);
    const updated: Profile = { 
      ...current, 
      ...profile, 
      updated_at: new Date().toISOString() 
    };
    setLocal(this.getUserKey('profile', uid), updated);

    const session = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
    if (session && session.user.id === uid) {
      if (profile.full_name) session.user.full_name = profile.full_name;
      if (profile.email) session.user.email = profile.email;
      if (profile.role) session.user.role = profile.role;
      if (profile.status) session.user.status = profile.status;
      setLocal(STORAGE_KEYS.SESSION, session);
    }

    return updated;
  }

  // ==========================================
  // CATEGORIAS (ISOLADAS POR CONTA)
  // ==========================================
  static async getCategories(targetUserId?: string): Promise<Category[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }

    if (!uid || !isValidUUID(uid)) {
      return [];
    }

    // Auto-provisionamento transparente em background
    await this.ensureUserProvisioned(uid);

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('categories')
          .select('*')
          .eq('user_id', uid)
          .order('name');
        
        if (!error && data && data.length > 0) {
          if (typeof window !== 'undefined') {
            setLocal(this.getUserKey('categories', uid), data);
          }
          return data as Category[];
        }
      }
    }

    return getLocal<Category[]>(
      this.getUserKey('categories', uid), 
      INITIAL_CATEGORIES.map(c => ({
        ...c,
        id: `cat_${uid.substring(0, 6)}_${c.id}`,
        user_id: uid
      }))
    );
  }

  static async addCategory(cat: Omit<Category, 'id'>, targetUserId?: string): Promise<Category> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      throw new Error('Usuário não autenticado. Faça login para adicionar categorias.');
    }

    await this.ensureUserProvisioned(uid);

    const payload = { 
      ...cat, 
      id: createUUID(),
      user_id: uid 
    };

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client.from('categories').insert(payload).select().maybeSingle();
        if (!error && data) return data as Category;
      }
    }
    const categories = await this.getCategories(uid);
    const newCat: Category = {
      ...payload,
      id: `cat_${uid.substring(0, 6)}_${Date.now()}`
    };
    categories.push(newCat);
    setLocal(this.getUserKey('categories', uid), categories);
    return newCat;
  }

  static async updateCategoryBudgetCap(id: string, cap: number, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('categories').update({ monthly_budget_cap: cap }).eq('id', id).eq('user_id', uid);
        return;
      }
    }
    const categories = await this.getCategories(uid);
    const index = categories.findIndex(c => c.id === id);
    if (index >= 0) {
      categories[index].monthly_budget_cap = cap;
      setLocal(this.getUserKey('categories', uid), categories);
    }
  }

  // ==========================================
  // CONTAS E CARTÕES (ISOLADOS POR CONTA)
  // ==========================================
  static async getAccounts(targetUserId?: string): Promise<AccountAndCard[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }

    if (!uid || !isValidUUID(uid)) {
      return [];
    }

    // Auto-provisionamento transparente em background
    await this.ensureUserProvisioned(uid);

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('accounts_and_cards')
          .select('*')
          .eq('user_id', uid)
          .order('name');
        
        if (!error && data && data.length > 0) {
          if (typeof window !== 'undefined') {
            setLocal(this.getUserKey('accounts', uid), data);
          }
          return data as AccountAndCard[];
        }
      }
    }

    return getLocal<AccountAndCard[]>(
      this.getUserKey('accounts', uid), 
      INITIAL_ACCOUNTS.map(a => ({
        ...a,
        id: `acc_${uid.substring(0, 6)}_${a.id}`,
        user_id: uid,
        balance: 0.00
      }))
    );
  }

  static async addAccount(acc: Omit<AccountAndCard, 'id'>, targetUserId?: string): Promise<AccountAndCard> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      throw new Error('Usuário não autenticado. Faça login para adicionar contas.');
    }

    await this.ensureUserProvisioned(uid);

    const payload = { 
      ...acc, 
      id: createUUID(),
      user_id: uid 
    };

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client.from('accounts_and_cards').insert(payload).select().maybeSingle();
        if (!error && data) return data as AccountAndCard;
      }
    }
    const accounts = await this.getAccounts(uid);
    const newAcc: AccountAndCard = {
      ...payload,
      id: `acc_${uid.substring(0, 6)}_${Date.now()}`
    };
    accounts.push(newAcc);
    setLocal(this.getUserKey('accounts', uid), accounts);
    return newAcc;
  }

  static async updateAccount(acc: AccountAndCard, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('accounts_and_cards').update(acc).eq('id', acc.id).eq('user_id', uid);
        return;
      }
    }
    const accounts = await this.getAccounts(uid);
    const index = accounts.findIndex(a => a.id === acc.id);
    if (index >= 0) {
      accounts[index] = { ...acc, user_id: uid };
      setLocal(this.getUserKey('accounts', uid), accounts);
    }
  }

  static async deleteAccount(id: string, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('accounts_and_cards').delete().eq('id', id).eq('user_id', uid);
        return;
      }
    }
    const accounts = await this.getAccounts(uid);
    const filtered = accounts.filter(a => a.id !== id);
    setLocal(this.getUserKey('accounts', uid), filtered);
  }

  // ==========================================
  // TRANSAÇÕES (ISOLADAS POR CONTA)
  // ==========================================
  static async getTransactions(targetUserId?: string): Promise<Transaction[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }

    if (!uid || !isValidUUID(uid)) {
      return [];
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('transactions')
          .select('*')
          .eq('user_id', uid)
          .order('date', { ascending: false });

        if (!error && data) {
          if (typeof window !== 'undefined') {
            setLocal(this.getUserKey('transactions', uid), data);
          }
          return data as Transaction[];
        }
      }
    }

    return getLocal<Transaction[]>(this.getUserKey('transactions', uid), []);
  }

  static async addTransaction(
    tx: Omit<Transaction, 'id'>, 
    generateRemainingInstallments: boolean = false,
    targetUserId?: string
  ): Promise<Transaction[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }

    if (!uid || !isValidUUID(uid)) {
      throw new Error('Usuário não autenticado. Faça login para registrar transações.');
    }

    // Auto-provisionamento garante que profiles/categorias existam sem erro de FK
    await this.ensureUserProvisioned(uid);

    const created: Transaction[] = [];

    if (generateRemainingInstallments && tx.installment_current && tx.installment_total && tx.installment_total > tx.installment_current) {
      const groupId = createUUID();
      const startDate = parseISO(tx.date);

      for (let i = tx.installment_current; i <= tx.installment_total; i++) {
        const offsetMonths = i - tx.installment_current;
        const targetDate = format(addMonths(startDate, offsetMonths), 'yyyy-MM-dd');
        
        const item: Transaction = {
          ...tx,
          user_id: uid,
          id: createUUID(),
          date: targetDate,
          installment_current: i,
          installment_total: tx.installment_total,
          installment_group_id: groupId,
          description: tx.description.includes('/') ? tx.description : `${tx.description} (${i}/${tx.installment_total})`
        };
        created.push(item);
      }
    } else {
      created.push({
        ...tx,
        user_id: uid,
        id: createUUID()
      });
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const dbPayload = created.map(item => ({
          ...item,
          id: isValidUUID(item.id) ? item.id : createUUID(),
          user_id: uid,
          account_id: isValidUUID(item.account_id) ? item.account_id : null,
          category_id: isValidUUID(item.category_id) ? item.category_id : null,
        }));
        const { error } = await client.from('transactions').insert(dbPayload);
        if (error) {
          console.warn('Persistência no Supabase com advertência, mantendo integridade no isolamento local:', error);
          const current = await this.getTransactions(uid);
          const updated = [...created, ...current];
          setLocal(this.getUserKey('transactions', uid), updated);
        }
      }
    } else {
      const current = await this.getTransactions(uid);
      const updated = [...created, ...current];
      setLocal(this.getUserKey('transactions', uid), updated);
    }

    // Atualiza saldo da conta se selecionada
    if (tx.account_id) {
      const accounts = await this.getAccounts(uid);
      const acc = accounts.find(a => a.id === tx.account_id);
      if (acc) {
        const delta = tx.type === 'income' ? Number(tx.amount) : -Number(tx.amount);
        acc.balance = Number(acc.balance) + delta;
        await this.updateAccount(acc, uid);
      }
    }

    return created;
  }

  static async deleteTransaction(id: string, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('transactions').delete().eq('id', id).eq('user_id', uid);
        return;
      }
    }
    const current = await this.getTransactions(uid);
    const filtered = current.filter(t => t.id !== id);
    setLocal(this.getUserKey('transactions', uid), filtered);
  }

  static async updateTransaction(tx: Transaction, targetUserId?: string): Promise<Transaction> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return tx;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('transactions').update({
          ...tx,
          user_id: uid,
          account_id: isValidUUID(tx.account_id) ? tx.account_id : null,
          category_id: isValidUUID(tx.category_id) ? tx.category_id : null,
          updated_at: new Date().toISOString()
        }).eq('id', tx.id).eq('user_id', uid);
      }
    }
    const current = await this.getTransactions(uid);
    const index = current.findIndex(t => t.id === tx.id);
    if (index >= 0) {
      current[index] = { ...current[index], ...tx, user_id: uid, updated_at: new Date().toISOString() };
      setLocal(this.getUserKey('transactions', uid), current);
    }
    return tx;
  }

  static async toggleTransactionStatus(id: string, targetUserId?: string): Promise<Transaction | null> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return null;

    const current = await this.getTransactions(uid);
    const tx = current.find(t => t.id === id);
    if (!tx) return null;

    const newStatus = tx.status === 'completed' ? 'pending' : 'completed';
    const updatedTx: Transaction = {
      ...tx,
      user_id: uid,
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    await this.updateTransaction(updatedTx, uid);

    // Ajusta saldo da conta vinculada
    if (tx.account_id) {
      const accounts = await this.getAccounts(uid);
      const acc = accounts.find(a => a.id === tx.account_id);
      if (acc) {
        const val = Number(tx.amount);
        let delta = 0;
        if (newStatus === 'completed') {
          delta = tx.type === 'income' ? val : -val;
        } else {
          delta = tx.type === 'income' ? -val : val;
        }
        acc.balance = Number(acc.balance) + delta;
        await this.updateAccount(acc, uid);
      }
    }

    return updatedTx;
  }

  // ==========================================
  // IMPORTAÇÃO DE FATURAS E EXTRATOS NUBANK (100% AUTOMÁTICA)
  // ==========================================
  static async importNubankBatch(
    items: ParsedNubankItem[],
    accountId?: string,
    targetUserId?: string
  ): Promise<{ importedCount: number; ignoredDuplicates: number }> {
    const isCloud = isSupabaseConfigured();
    const client = isCloud ? getSupabase() : null;

    // 1. Identifica o usuário ativo garantindo UUID
    let uid = targetUserId || this.getActiveUserId();
    if (client && (!uid || !isValidUUID(uid))) {
      try {
        const { data: authData } = await client.auth.getSession();
        if (authData?.session?.user?.id && isValidUUID(authData.session.user.id)) {
          uid = authData.session.user.id;
          this.setActiveUserId(uid);
        }
      } catch (e) {
        console.warn('Erro ao obter sessão no importNubankBatch:', e);
      }
    }

    if (!uid || !isValidUUID(uid)) {
      throw new Error('Não foi possível identificar o usuário ativo. Faça login novamente.');
    }

    // 2. Garante provisionamento automático (perfil, contas, categorias) para zero-configuração
    await this.ensureUserProvisioned(uid);

    // 3. Obtém contas, categorias e transações existentes estritamente para o usuário ativo
    const [existingTransactions, userAccounts, userCategories] = await Promise.all([
      this.getTransactions(uid),
      this.getAccounts(uid),
      this.getCategories(uid)
    ]);

    // Resolve conta de destino
    let targetAcc = userAccounts.find(a => a.id === accountId);
    if (!targetAcc) {
      const hasInstallments = items.some(it => it.isInstallment);
      if (hasInstallments) {
        targetAcc = userAccounts.find(a => a.type === 'credit_card') || userAccounts[0];
      } else {
        targetAcc = userAccounts.find(a => a.type === 'checking') || userAccounts[0];
      }
    }

    let validDbAccountId: string | null = null;
    if (targetAcc && isValidUUID(targetAcc.id)) {
      validDbAccountId = targetAcc.id;
    }

    const existingHashes = new Set(existingTransactions.map(t => t.csv_hash).filter(Boolean));
    const selectedItems = items.filter(it => it.selected);

    const newTransactions: Transaction[] = [];
    let ignoredDuplicates = 0;
    let netAmountImpact = 0;

    for (const item of selectedItems) {
      if (existingHashes.has(item.hash) && !item.forceImport) {
        ignoredDuplicates++;
        continue;
      }

      // Encontra a categoria correspondente por nome ou slug
      const catMatch = userCategories.find(c => 
        c.name.trim().toLowerCase() === item.categoryName.trim().toLowerCase() ||
        c.slug.trim().toLowerCase() === item.categoryName.trim().toLowerCase()
      );

      const resolvedCatId = catMatch && isValidUUID(catMatch.id) ? catMatch.id : undefined;

      const txId = createUUID();
      const newTx: Transaction = {
        id: txId,
        user_id: uid,
        account_id: validDbAccountId || undefined,
        category_id: resolvedCatId,
        category_name: item.categoryName || catMatch?.name || 'Outros',
        date: item.date,
        description: item.cleanTitle,
        original_title: item.originalTitle,
        amount: item.amount,
        type: item.type,
        status: 'completed',
        installment_current: item.installmentCurrent,
        installment_total: item.installmentTotal,
        is_recurring: false,
        imported_via_csv: true,
        csv_hash: item.hash,
        created_at: new Date().toISOString()
      };

      newTransactions.push(newTx);

      if (item.type === 'income') {
        netAmountImpact += item.amount;
      } else if (item.type === 'expense') {
        netAmountImpact -= item.amount;
      }
    }

    if (newTransactions.length > 0) {
      if (client && isValidUUID(uid)) {
        const dbTransactions = newTransactions.map(item => ({
          id: isValidUUID(item.id) ? item.id : createUUID(),
          user_id: uid,
          account_id: validDbAccountId,
          category_id: item.category_id && isValidUUID(item.category_id) ? item.category_id : null,
          category_name: item.category_name,
          date: item.date,
          description: item.description,
          original_title: item.original_title || null,
          amount: Number(item.amount),
          type: item.type,
          status: item.status || 'completed',
          installment_current: item.installment_current || null,
          installment_total: item.installment_total || null,
          installment_group_id: null,
          is_recurring: false,
          recurrence_interval: null,
          imported_via_csv: true,
          csv_hash: item.csv_hash || null,
          notes: null,
          created_at: item.created_at || new Date().toISOString(),
          updated_at: new Date().toISOString()
        }));

        // Inserção em lotes com tratamento tolerante sem exigir DDL do usuário
        const BATCH_SIZE = 100;
        for (let i = 0; i < dbTransactions.length; i += BATCH_SIZE) {
          const chunk = dbTransactions.slice(i, i + BATCH_SIZE);
          const { error: insertError } = await client.from('transactions').insert(chunk);
          if (insertError) {
            console.warn('Lote inserido com fallback para armazenamento isolado local:', insertError);
            break;
          }
        }
      }

      // Sincroniza armazenamento isolado do usuário com as transações inseridas
      const merged = [...newTransactions, ...existingTransactions];
      setLocal(this.getUserKey('transactions', uid), merged);

      // Atualiza saldo da conta
      if (targetAcc) {
        targetAcc.balance = Number(targetAcc.balance || 0) + netAmountImpact;
        await this.updateAccount(targetAcc, uid);
      }
    }

    return {
      importedCount: newTransactions.length,
      ignoredDuplicates
    };
  }


  // ==========================================
  // ORÇAMENTOS E METAS (ISOLADOS POR CONTA)
  // ==========================================
  static async getBudgets(targetUserId?: string): Promise<MonthlyBudget[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }
    if (!uid || !isValidUUID(uid)) return [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client.from('monthly_budgets').select('*').eq('user_id', uid);
        if (!error && data) {
          setLocal(this.getUserKey('budgets', uid), data);
          return data as MonthlyBudget[];
        }
      }
    }
    return getLocal<MonthlyBudget[]>(this.getUserKey('budgets', uid), []);
  }

  static async updateBudget(budget: MonthlyBudget, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    const payload = { 
      ...budget, 
      id: isValidUUID(budget.id) ? budget.id : createUUID(),
      user_id: uid 
    };

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('monthly_budgets').upsert(payload);
        return;
      }
    }
    const current = await this.getBudgets(uid);
    const index = current.findIndex(b => b.category_id === budget.category_id && b.year === budget.year && b.month === budget.month);
    if (index >= 0) {
      current[index] = payload;
    } else {
      current.push({ ...payload, id: `bg_${uid.substring(0, 6)}_${Date.now()}` });
    }
    setLocal(this.getUserKey('budgets', uid), current);
  }

  static async getGoals(targetUserId?: string): Promise<FinancialGoal[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }
    if (!uid || !isValidUUID(uid)) return [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client
          .from('financial_goals')
          .select('*')
          .eq('user_id', uid)
          .order('created_at');
        if (!error && data) {
          setLocal(this.getUserKey('goals', uid), data);
          return data as FinancialGoal[];
        }
      }
    }
    return getLocal<FinancialGoal[]>(this.getUserKey('goals', uid), []);
  }

  static async addGoal(goal: Omit<FinancialGoal, 'id'>, targetUserId?: string): Promise<FinancialGoal> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      throw new Error('Usuário não autenticado. Faça login para adicionar metas.');
    }

    const payload = { 
      ...goal, 
      id: createUUID(),
      user_id: uid 
    };

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client.from('financial_goals').insert(payload).select().maybeSingle();
        if (!error && data) return data as FinancialGoal;
      }
    }
    const goals = await this.getGoals(uid);
    const newGoal: FinancialGoal = {
      ...payload,
      id: `goal_${uid.substring(0, 6)}_${Date.now()}`
    };
    goals.push(newGoal);
    setLocal(this.getUserKey('goals', uid), goals);
    return newGoal;
  }

  static async updateGoal(goal: FinancialGoal, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('financial_goals').update(goal).eq('id', goal.id).eq('user_id', uid);
        return;
      }
    }
    const goals = await this.getGoals(uid);
    const index = goals.findIndex(g => g.id === goal.id);
    if (index >= 0) {
      goals[index] = { ...goal, user_id: uid };
      setLocal(this.getUserKey('goals', uid), goals);
    }
  }

  static async deleteGoal(id: string, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('financial_goals').delete().eq('id', id).eq('user_id', uid);
        return;
      }
    }
    const goals = await this.getGoals(uid);
    const filtered = goals.filter(g => g.id !== id);
    setLocal(this.getUserKey('goals', uid), filtered);
  }

  static async addGoalContribution(
    goalId: string, 
    amount: number, 
    accountId?: string, 
    targetUserId?: string
  ): Promise<FinancialGoal | null> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return null;

    const goals = await this.getGoals(uid);
    const goal = goals.find(g => g.id === goalId);
    if (!goal) return null;

    const newCurrent = Number(goal.current_amount) + Number(amount);
    const isCompleted = newCurrent >= Number(goal.target_amount);
    const updatedGoal: FinancialGoal = {
      ...goal,
      user_id: uid,
      current_amount: newCurrent,
      is_completed: isCompleted,
      updated_at: new Date().toISOString()
    };

    await this.updateGoal(updatedGoal, uid);

    // Registra transação de investimento correspondente ao aporte
    await this.addTransaction({
      date: new Date().toISOString().split('T')[0],
      description: `Aporte: ${goal.title}`,
      amount: amount,
      type: 'investment',
      status: 'completed',
      category_name: 'Reserva & Metas',
      account_id: accountId,
      imported_via_csv: false,
      is_recurring: false
    }, false, uid);

    return updatedGoal;
  }

  // ==========================================
  // GASTOS FIXOS (CONTAS RECORRENTES MENSAIS)
  // ==========================================
  static async getFixedExpenses(targetUserId?: string): Promise<FixedExpense[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }
    if (!uid || !isValidUUID(uid)) return [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client
            .from('fixed_expenses')
            .select('*')
            .eq('user_id', uid)
            .order('due_day', { ascending: true });
          if (!error && data) {
            setLocal(this.getUserKey('fixed_expenses', uid), data);
            return data as FixedExpense[];
          }
        } catch {}
      }
    }
    return getLocal<FixedExpense[]>(this.getUserKey('fixed_expenses', uid), INITIAL_FIXED_EXPENSES);
  }

  static async addFixedExpense(
    item: Omit<FixedExpense, 'id'>, 
    targetUserId?: string
  ): Promise<FixedExpense> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      throw new Error('Usuário não autenticado. Faça login para adicionar gastos fixos.');
    }

    const payload = {
      ...item,
      id: createUUID(),
      user_id: uid
    };

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client
            .from('fixed_expenses')
            .insert(payload)
            .select()
            .maybeSingle();
          if (!error && data) return data as FixedExpense;
        } catch {}
      }
    }
    const current = await this.getFixedExpenses(uid);
    const newFixed: FixedExpense = {
      ...payload,
      id: `fix_${Date.now()}`
    };
    current.push(newFixed);
    setLocal(this.getUserKey('fixed_expenses', uid), current);
    return newFixed;
  }

  static async updateFixedExpense(item: FixedExpense, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          await client.from('fixed_expenses').update({ ...item, user_id: uid, updated_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', uid);
        } catch {}
      }
    }
    const current = await this.getFixedExpenses(uid);
    const index = current.findIndex(f => f.id === item.id);
    if (index >= 0) {
      current[index] = { ...current[index], ...item, user_id: uid, updated_at: new Date().toISOString() };
      setLocal(this.getUserKey('fixed_expenses', uid), current);
    }
  }

  static async deleteFixedExpense(id: string, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          await client.from('fixed_expenses').delete().eq('id', id).eq('user_id', uid);
        } catch {}
      }
    }
    const current = await this.getFixedExpenses(uid);
    const filtered = current.filter(f => f.id !== id);
    setLocal(this.getUserKey('fixed_expenses', uid), filtered);
  }

  // ==========================================
  // CONTROLE DE DÍVIDAS E PARCELAMENTOS
  // ==========================================
  static async getDebts(targetUserId?: string): Promise<Debt[]> {
    let uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      try {
        const client = getSupabase();
        if (client) {
          const { data } = await client.auth.getSession();
          if (data?.session?.user?.id && isValidUUID(data.session.user.id)) {
            uid = data.session.user.id;
            this.setActiveUserId(uid);
          }
        }
      } catch {}
    }
    if (!uid || !isValidUUID(uid)) return [];

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client
            .from('debts')
            .select('*')
            .eq('user_id', uid)
            .order('created_at', { ascending: false });
          if (!error && data) {
            setLocal(this.getUserKey('debts', uid), data);
            return data as Debt[];
          }
        } catch {}
      }
    }
    return getLocal<Debt[]>(this.getUserKey('debts', uid), INITIAL_DEBTS);
  }

  static async addDebt(item: Omit<Debt, 'id'>, targetUserId?: string): Promise<Debt> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) {
      throw new Error('Usuário não autenticado. Faça login para registrar dívidas.');
    }

    const payload = {
      ...item,
      id: createUUID(),
      user_id: uid
    };

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          const { data, error } = await client
            .from('debts')
            .insert(payload)
            .select()
            .maybeSingle();
          if (!error && data) return data as Debt;
        } catch {}
      }
    }
    const current = await this.getDebts(uid);
    const newDebt: Debt = {
      ...payload,
      id: `debt_${Date.now()}`
    };
    current.push(newDebt);
    setLocal(this.getUserKey('debts', uid), current);
    return newDebt;
  }

  static async updateDebt(item: Debt, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          await client.from('debts').update({ ...item, user_id: uid, updated_at: new Date().toISOString() }).eq('id', item.id).eq('user_id', uid);
        } catch {}
      }
    }
    const current = await this.getDebts(uid);
    const index = current.findIndex(d => d.id === item.id);
    if (index >= 0) {
      current[index] = { ...current[index], ...item, user_id: uid, updated_at: new Date().toISOString() };
      setLocal(this.getUserKey('debts', uid), current);
    }
  }

  static async deleteDebt(id: string, targetUserId?: string): Promise<void> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return;

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        try {
          await client.from('debts').delete().eq('id', id).eq('user_id', uid);
        } catch {}
      }
    }
    const current = await this.getDebts(uid);
    const filtered = current.filter(d => d.id !== id);
    setLocal(this.getUserKey('debts', uid), filtered);
  }

  static async amortizeDebt(
    debtId: string, 
    amount: number, 
    accountId?: string, 
    targetUserId?: string
  ): Promise<Debt | null> {
    const uid = targetUserId || this.getActiveUserId();
    if (!uid || !isValidUUID(uid)) return null;

    const debts = await this.getDebts(uid);
    const debt = debts.find(d => d.id === debtId);
    if (!debt) return null;

    const newPaidInstallments = Math.min(debt.total_installments, debt.paid_installments + 1);
    const updatedDebt: Debt = {
      ...debt,
      user_id: uid,
      paid_installments: newPaidInstallments,
      updated_at: new Date().toISOString()
    };

    await this.updateDebt(updatedDebt, uid);

    // Registra transação de despesa correspondente
    await this.addTransaction({
      date: new Date().toISOString().split('T')[0],
      description: `Parcela: ${debt.title} (${newPaidInstallments}/${debt.total_installments})`,
      amount: amount,
      type: 'expense',
      status: 'completed',
      category_name: 'Dívidas & Empréstimos',
      account_id: accountId,
      imported_via_csv: false,
      is_recurring: false
    }, false, uid);

    return updatedDebt;
  }

  // ==========================================
  // BACKUP EXPORTAÇÃO E RESTAURAÇÃO (ISOLADO)
  // ==========================================
  static exportBackup(): string {
    const uid = this.getActiveUserId();
    const backupData = {
      version: '2.0.0',
      exportedAt: new Date().toISOString(),
      userId: uid,
      profile: getLocal(this.getUserKey('profile', uid), INITIAL_PROFILE),
      categories: getLocal(this.getUserKey('categories', uid), INITIAL_CATEGORIES),
      accounts: getLocal(this.getUserKey('accounts', uid), INITIAL_ACCOUNTS),
      transactions: getLocal(this.getUserKey('transactions', uid), []),
      goals: getLocal(this.getUserKey('goals', uid), []),
      budgets: getLocal(this.getUserKey('budgets', uid), []),
    };
    return JSON.stringify(backupData, null, 2);
  }

  static async importBackup(jsonString: string): Promise<boolean> {
    try {
      if (jsonString.includes('__proto__') || jsonString.includes('constructor') || jsonString.includes('prototype')) {
        throw new Error('Arquivo de backup contém propriedades suspeitas ou inválidas.');
      }

      const data = JSON.parse(jsonString);

      if (!data || typeof data !== 'object') {
        throw new Error('Conteúdo do arquivo não é um objeto JSON válido.');
      }

      if (!Array.isArray(data.accounts) || !Array.isArray(data.categories) || !Array.isArray(data.transactions)) {
        throw new Error('Arquivo de backup inválido: as coleções de contas, categorias ou transações estão corrompidas.');
      }

      const uid = this.getActiveUserId();

      if (data.profile && typeof data.profile === 'object') {
        setLocal(this.getUserKey('profile', uid), { ...data.profile, id: uid });
      }
      setLocal(this.getUserKey('categories', uid), data.categories);
      setLocal(this.getUserKey('accounts', uid), data.accounts);
      setLocal(this.getUserKey('transactions', uid), data.transactions);

      if (Array.isArray(data.goals)) {
        setLocal(this.getUserKey('goals', uid), data.goals);
      }
      if (Array.isArray(data.budgets)) {
        setLocal(this.getUserKey('budgets', uid), data.budgets);
      }

      return true;
    } catch (err) {
      console.error('Erro ao restaurar backup:', err);
      throw err;
    }
  }

  // ==========================================
  // AUTENTICAÇÃO E GESTÃO DE SESSÃO (SUPABASE)
  // ==========================================
  static async getCurrentSession(): Promise<AuthSession | null> {
    // 1. Retorno instantâneo do cache em memória para chamadas concorrentes
    const now = Date.now();
    if (this.sessionCache && this.sessionCache.expiresAt > now) {
      return this.sessionCache.session;
    }

    // 2. Se já houver uma busca de sessão em andamento, compartilha a mesma Promise (deduplicação)
    if (this.currentSessionPromise) {
      return this.currentSessionPromise;
    }

    this.currentSessionPromise = (async () => {
      try {
        if (!isSupabaseConfigured()) {
          const localSession = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
          return localSession;
        }

        const client = getSupabase();
        if (!client) {
          const localSession = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
          return localSession;
        }

        const { data, error } = await client.auth.getSession();
        if (error || !data?.session || !data.session.user) {
          // RESILIÊNCIA: Se for erro de rede/offline momentâneo, NÃO apaga a sessão se tivermos dados locais
          const isNetworkIssue = error?.message?.toLowerCase().includes('fetch') || 
                                 error?.message?.toLowerCase().includes('network') ||
                                 (typeof navigator !== 'undefined' && !navigator.onLine);
          
          if (isNetworkIssue) {
            const cached = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
            if (cached?.user?.id) {
              this.setActiveUserId(cached.user.id);
              return cached;
            }
          }

          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
          }
          this.sessionCache = null;
          return null;
        }

        const u = data.session.user;
        if (!u.id || !isValidUUID(u.id)) {
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
          }
          this.sessionCache = null;
          return null;
        }

        // Consulta status e perfil no Supabase de forma protegida contra falhas de rede
        let profile: any = null;
        try {
          const { data: profData, error: profErr } = await client
            .from('profiles')
            .select('role, status, full_name, avatar_url')
            .eq('id', u.id)
            .maybeSingle();
          if (!profErr && profData) {
            profile = profData;
          }
        } catch (pe) {
          console.warn('Sincronização de perfil Supabase indisponível no momento:', pe);
        }

        if (profile?.status === 'blocked') {
          await client.auth.signOut();
          if (typeof window !== 'undefined') {
            localStorage.removeItem(STORAGE_KEYS.SESSION);
          }
          this.sessionCache = null;
          return null;
        }

        const existingSession = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);

        const session: AuthSession = {
          user: {
            id: u.id,
            email: u.email || existingSession?.user?.email || '',
            full_name: profile?.full_name || u.user_metadata?.full_name || existingSession?.user?.full_name || u.email?.split('@')[0] || 'Usuário',
            role: (profile?.role as UserRole) || existingSession?.user?.role || 'user',
            status: (profile?.status as UserAccountStatus) || existingSession?.user?.status || 'active',
            created_at: u.created_at,
            is_local: false
          },
          token: data.session.access_token,
          created_at: new Date().toISOString()
        };

        this.setActiveUserId(u.id);
        setLocal(STORAGE_KEYS.SESSION, session);
        this.sessionCache = { session, expiresAt: Date.now() + this.SESSION_CACHE_TTL_MS };

        // Auto-provisionamento em segundo plano sem bloquear a resposta da sessão
        this.ensureUserProvisioned(u.id, session.user.email, session.user.full_name).catch(console.warn);

        return session;
      } catch (err: any) {
        console.warn('Falha momentânea na validação da sessão Supabase:', err);
        // RESILIÊNCIA OFFLINE: Em caso de falha de conexão, preserva o usuário autenticado com base no cache local
        const cached = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
        if (cached?.user?.id) {
          this.setActiveUserId(cached.user.id);
          return cached;
        }
        return null;
      } finally {
        this.currentSessionPromise = null;
      }
    })();

    return this.currentSessionPromise;
  }

  static async getCurrentUser() {
    const session = await this.getCurrentSession();
    return session?.user || null;
  }

  static async isCurrentUserAdmin(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user?.role === 'admin';
  }

  static async signInWithEmail(email: string, password: string): Promise<{
    data: { user: AuthSession['user'] | null; session: any | null };
    error: { message: string } | null;
  }> {
    if (!isSupabaseConfigured()) {
      return { 
        data: { user: null, session: null }, 
        error: { message: 'Configuração do Supabase não encontrada no .env.local.' } 
      };
    }

    const client = getSupabase();
    if (!client) {
      return { 
        data: { user: null, session: null }, 
        error: { message: 'Não foi possível conectar ao cliente Supabase.' } 
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const res = await client.auth.signInWithPassword({ email: cleanEmail, password });

    if (res.error) {
      let friendlyMessage = res.error.message;
      if (res.error.message.includes('Invalid login credentials')) {
        friendlyMessage = 'Email ou senha incorretos. Verifique suas credenciais.';
      } else if (res.error.message.includes('Email not confirmed')) {
        friendlyMessage = 'Seu email ainda não foi confirmado. Verifique sua caixa de entrada para ativar sua conta.';
      } else if (res.error.message.includes('Too many requests')) {
        friendlyMessage = 'Muitas tentativas sem sucesso. Aguarde alguns instantes e tente novamente.';
      } else if (res.error.message.includes('User not found')) {
        friendlyMessage = 'Nenhuma conta encontrada com este email no Supabase.';
      }
      return { 
        data: { user: null, session: null }, 
        error: { message: friendlyMessage } 
      };
    }

    if (res.data?.session && res.data?.user) {
      const u = res.data.user;
      const { data: profile } = await client
        .from('profiles')
        .select('role, status, full_name')
        .eq('id', u.id)
        .maybeSingle();

      if (profile?.status === 'blocked') {
        await client.auth.signOut();
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
        return { 
          data: { user: null, session: null }, 
          error: { message: 'Esta conta foi suspensa pelo administrador.' } 
        };
      }

      if (profile?.status === 'pending') {
        await client.auth.signOut();
        if (typeof window !== 'undefined') {
          localStorage.removeItem(STORAGE_KEYS.SESSION);
        }
        return { 
          data: { user: null, session: null }, 
          error: { message: 'Esta conta está aguardando aprovação pelo administrador.' } 
        };
      }

      // Se profile não existir no Supabase, cria agora
      if (!profile) {
        try {
          await client.from('profiles').upsert({
            id: u.id,
            email: cleanEmail,
            full_name: u.user_metadata?.full_name || cleanEmail.split('@')[0],
            role: 'user',
            status: 'active'
          }, { onConflict: 'id' });
        } catch (e) {
          console.warn('Erro ao garantir registro em profiles:', e);
        }
      }

      const session: AuthSession = {
        user: {
          id: u.id,
          email: u.email || cleanEmail,
          full_name: profile?.full_name || u.user_metadata?.full_name || cleanEmail.split('@')[0],
          role: (profile?.role as UserRole) || 'user',
          status: (profile?.status as UserAccountStatus) || 'active',
          created_at: u.created_at,
          is_local: false
        },
        token: res.data.session.access_token,
        created_at: new Date().toISOString()
      };

      this.setActiveUserId(u.id);
      setLocal(STORAGE_KEYS.SESSION, session);

      // Auto-provisionamento imediato para a conta que acabou de entrar
      await this.ensureUserProvisioned(u.id, session.user.email, session.user.full_name);

      return { data: { user: session.user, session: res.data.session }, error: null };
    }

    return { 
      data: { user: null, session: null }, 
      error: { message: 'Não foi possível estabelecer a sessão. Tente novamente.' } 
    };
  }

  static async signUpWithEmail(
    email: string, 
    password: string, 
    fullName: string, 
    baseIncome?: number
  ): Promise<{
    data: { user: any | null; session: any | null; needsEmailConfirmation?: boolean };
    error: { message: string } | null;
  }> {
    if (!isSupabaseConfigured()) {
      return { 
        data: { user: null, session: null }, 
        error: { message: 'Configuração do Supabase ausente. Verifique o .env.local.' } 
      };
    }

    const client = getSupabase();
    if (!client) {
      return { 
        data: { user: null, session: null }, 
        error: { message: 'Cliente Supabase não inicializado.' } 
      };
    }

    const cleanEmail = email.trim().toLowerCase();
    const res = await client.auth.signUp({
      email: cleanEmail,
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          base_monthly_income: baseIncome || 0
        }
      }
    });

    if (res.error) {
      let friendlyMessage = res.error.message;
      if (res.error.message.includes('User already registered')) {
        friendlyMessage = 'Já existe uma conta registrada no Supabase com este email. Faça login na aba Entrar.';
      } else if (res.error.message.includes('Password should be at least 6 characters')) {
        friendlyMessage = 'A senha deve conter no mínimo 6 caracteres.';
      } else if (res.error.message.includes('Signup requires a valid password')) {
        friendlyMessage = 'Informe uma senha válida com pelo menos 6 caracteres.';
      }
      return { 
        data: { user: null, session: null }, 
        error: { message: friendlyMessage } 
      };
    }

    // Caso 1: Usuário já autenticado na hora (confirmação por email desabilitada no Supabase)
    if (res.data?.session && res.data?.user) {
      const u = res.data.user;
      try {
        await client.from('profiles').upsert({
          id: u.id,
          email: cleanEmail,
          full_name: fullName.trim(),
          base_monthly_income: baseIncome || 0,
          role: 'user',
          status: 'active'
        }, { onConflict: 'id' });
      } catch (err) {
        console.warn('Erro ao atualizar profile pós-signup:', err);
      }

      const session: AuthSession = {
        user: {
          id: u.id,
          email: cleanEmail,
          full_name: fullName.trim(),
          role: 'user',
          status: 'active',
          created_at: u.created_at,
          is_local: false
        },
        token: res.data.session.access_token,
        created_at: new Date().toISOString()
      };
      
      this.setActiveUserId(u.id);
      setLocal(STORAGE_KEYS.SESSION, session);

      // Auto-provisionamento imediato da nova conta (profiles, categorias, contas)
      await this.ensureUserProvisioned(u.id, cleanEmail, fullName.trim(), baseIncome);

      return { 
        data: { 
          user: session.user, 
          session: res.data.session, 
          needsEmailConfirmation: false 
        }, 
        error: null 
      };
    }

    // Caso 2: Conta registrada no Supabase, aguardando confirmação por email
    if (res.data?.user) {
      return { 
        data: { 
          user: res.data.user, 
          session: null, 
          needsEmailConfirmation: true 
        }, 
        error: null 
      };
    }

    return { 
      data: { user: null, session: null }, 
      error: { message: 'Não foi possível concluir o registro. Tente novamente.' } 
    };
  }

  static async resetPasswordForEmail(email: string): Promise<{ error: { message: string } | null }> {
    if (!isSupabaseConfigured()) {
      return { error: { message: 'Supabase não está configurado.' } };
    }
    const client = getSupabase();
    if (!client) {
      return { error: { message: 'Cliente Supabase não disponível.' } };
    }
    const cleanEmail = email.trim().toLowerCase();
    const redirectUrl = typeof window !== 'undefined' ? `${window.location.origin}/login` : undefined;
    const res = await client.auth.resetPasswordForEmail(cleanEmail, {
      redirectTo: redirectUrl
    });
    if (res.error) {
      let friendly = res.error.message;
      if (res.error.message.includes('User not found')) {
        friendly = 'Nenhuma conta cadastrada com este email.';
      }
      return { error: { message: friendly } };
    }
    return { error: null };
  }

  static async updateUserPassword(newPassword: string): Promise<{ error: { message: string } | null }> {
    if (!newPassword || newPassword.length < 6) {
      return { error: { message: 'A nova senha deve ter no mínimo 6 caracteres.' } };
    }
    if (!isSupabaseConfigured()) {
      return { error: { message: 'Supabase não está configurado.' } };
    }
    const client = getSupabase();
    if (!client) {
      return { error: { message: 'Cliente Supabase não inicializado.' } };
    }
    const res = await client.auth.updateUser({ password: newPassword });
    if (res.error) {
      return { error: { message: res.error.message } };
    }
    this.sessionCache = null;
    return { error: null };
  }

  static async signOut() {
    this.activeUserIdCache = '';
    this.sessionCache = null;
    this.currentSessionPromise = null;
    this.provisionedUsers.clear();
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEYS.SESSION);
      window.dispatchEvent(new CustomEvent('gf_auth_signout'));
    }
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        return await client.auth.signOut();
      }
    }
  }

  static async signInWithGoogle(redirectToPath?: string) {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado.');
    }
    const client = getSupabase();
    if (!client) throw new Error('Cliente Supabase não inicializado.');

    let redirectUrl: string | undefined = undefined;
    if (typeof window !== 'undefined') {
      const origin = window.location.origin;
      if (redirectToPath && redirectToPath.startsWith('/') && !redirectToPath.startsWith('//')) {
        redirectUrl = `${origin}${redirectToPath}`;
      } else {
        redirectUrl = `${origin}/`;
      }
    }

    return await client.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl
      }
    });
  }

  // ==========================================
  // PAINEL DE GESTÃO DE CONTAS (ADMIN)
  // ==========================================
  static async getSystemUsers(): Promise<SystemUser[]> {
    this.initLocalStore();

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data, error } = await client.from('profiles').select('*').order('created_at', { ascending: false });
        if (!error && data && data.length > 0) {
          return data.map((p: any) => ({
            id: p.id,
            email: p.email,
            full_name: p.full_name || 'Sem nome',
            role: (p.role as UserRole) || 'user',
            status: (p.status as UserAccountStatus) || 'active',
            base_monthly_income: Number(p.base_monthly_income || 0),
            created_at: p.created_at,
            updated_at: p.updated_at
          }));
        }
      }
    }

    const users = getLocal<SystemUser[]>(STORAGE_KEYS.USERS, []);
    return users.map(u => {
      const txs = getLocal<Transaction[]>(this.getUserKey('transactions', u.id), []);
      const accs = getLocal<AccountAndCard[]>(this.getUserKey('accounts', u.id), []);
      return {
        ...u,
        transactions_count: txs.length,
        accounts_count: accs.length
      };
    });
  }

  static async createSystemUser(data: {
    email: string;
    full_name: string;
    password: string;
    role?: UserRole;
    status?: UserAccountStatus;
    base_monthly_income?: number;
  }): Promise<SystemUser> {
    this.initLocalStore();
    const cleanEmail = data.email.trim().toLowerCase();

    // Se no Supabase, cadastra via Auth Admin ou SignUp
    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { data: signUpData, error: signUpError } = await client.auth.signUp({
          email: cleanEmail,
          password: data.password,
          options: {
            data: { full_name: data.full_name.trim() }
          }
        });
        if (signUpError) throw signUpError;
        if (signUpData.user) {
          await client.from('profiles').update({
            role: data.role || 'user',
            status: data.status || 'active',
            base_monthly_income: data.base_monthly_income || 0
          }).eq('id', signUpData.user.id);

          return {
            id: signUpData.user.id,
            email: cleanEmail,
            full_name: data.full_name.trim(),
            role: data.role || 'user',
            status: data.status || 'active',
            base_monthly_income: data.base_monthly_income || 0,
            created_at: new Date().toISOString()
          };
        }
      }
    }

    const users = getLocal<SystemUser[]>(STORAGE_KEYS.USERS, []);
    if (users.some(u => u.email.toLowerCase() === cleanEmail)) {
      throw new Error('Já existe um usuário cadastrado com este endereço de email.');
    }

    const newUser: SystemUser = {
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      email: cleanEmail,
      full_name: data.full_name.trim(),
      password: data.password,
      role: data.role || 'user',
      status: data.status || 'active',
      base_monthly_income: data.base_monthly_income || 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    users.push(newUser);
    setLocal(STORAGE_KEYS.USERS, users);

    this.initUserStore(newUser.id, {
      email: newUser.email,
      full_name: newUser.full_name,
      base_income: newUser.base_monthly_income,
      role: newUser.role,
      status: newUser.status
    });

    return newUser;
  }

  static async updateSystemUser(userId: string, updates: Partial<SystemUser>): Promise<SystemUser> {
    this.initLocalStore();

    if (userId === 'usr_admin_master') {
      if (updates.role && updates.role !== 'admin') {
        throw new Error('O Administrador Master não pode perder o cargo de administrador.');
      }
      if (updates.status && updates.status !== 'active') {
        throw new Error('O Administrador Master não pode ser desativado ou bloqueado.');
      }
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        const { error } = await client.from('profiles').update({
          ...(updates.role && { role: updates.role }),
          ...(updates.status && { status: updates.status }),
          ...(updates.full_name && { full_name: updates.full_name }),
          ...(updates.base_monthly_income !== undefined && { base_monthly_income: updates.base_monthly_income }),
          updated_at: new Date().toISOString()
        }).eq('id', userId);
        if (error) throw error;
      }
    }

    const users = getLocal<SystemUser[]>(STORAGE_KEYS.USERS, []);
    const idx = users.findIndex(u => u.id === userId);

    if (idx !== -1) {
      const updatedUser: SystemUser = {
        ...users[idx],
        ...updates,
        updated_at: new Date().toISOString()
      };
      users[idx] = updatedUser;
      setLocal(STORAGE_KEYS.USERS, users);
    }

    const session = getLocal<AuthSession | null>(STORAGE_KEYS.SESSION, null);
    if (session && session.user.id === userId) {
      if (updates.full_name) session.user.full_name = updates.full_name;
      if (updates.role) session.user.role = updates.role;
      if (updates.status) session.user.status = updates.status;
      setLocal(STORAGE_KEYS.SESSION, session);
    }

    return {
      id: userId,
      email: updates.email || '',
      full_name: updates.full_name || '',
      role: updates.role || 'user',
      status: updates.status || 'active',
      created_at: new Date().toISOString()
    };
  }

  static async toggleUserStatus(userId: string, newStatus: UserAccountStatus): Promise<void> {
    await this.updateSystemUser(userId, { status: newStatus });
  }

  static async toggleUserRole(userId: string, newRole: UserRole): Promise<void> {
    await this.updateSystemUser(userId, { role: newRole });
  }

  static async resetUserPassword(userId: string, newPass: string): Promise<void> {
    if (!newPass || newPass.length < 6) {
      throw new Error('A nova senha deve ter no mínimo 6 caracteres.');
    }
    await this.updateSystemUser(userId, { password: newPass });
  }

  static async deleteSystemUser(userId: string): Promise<void> {
    this.initLocalStore();
    if (userId === 'usr_admin_master') {
      throw new Error('O Administrador Master não pode ser excluído.');
    }

    if (isSupabaseConfigured()) {
      const client = getSupabase();
      if (client) {
        await client.from('profiles').delete().eq('id', userId);
      }
    }

    const users = getLocal<SystemUser[]>(STORAGE_KEYS.USERS, []);
    const filtered = users.filter(u => u.id !== userId);
    setLocal(STORAGE_KEYS.USERS, filtered);

    if (typeof window !== 'undefined') {
      localStorage.removeItem(this.getUserKey('profile', userId));
      localStorage.removeItem(this.getUserKey('categories', userId));
      localStorage.removeItem(this.getUserKey('accounts', userId));
      localStorage.removeItem(this.getUserKey('transactions', userId));
      localStorage.removeItem(this.getUserKey('goals', userId));
      localStorage.removeItem(this.getUserKey('budgets', userId));
      localStorage.removeItem(this.getUserKey('initialized', userId));
    }
  }

  // ==============================================================================
  // MIGRAÇÃO COMPLETA: TRANSFERIR DADOS DO LOCALSTORAGE PARA O SUPABASE & LIMPAR LOCAL
  // ==============================================================================
  static async migrateAllLocalDataToSupabase(): Promise<MigrationResult> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Conecte sua URL e Chave Anon primeiro.');
    }

    const client = getSupabase();
    if (!client) {
      throw new Error('Cliente Supabase não pôde ser inicializado.');
    }

    // 1. Obtém o usuário atualmente autenticado no Supabase
    const { data: authData, error: authError } = await client.auth.getUser();
    if (authError || !authData.user) {
      throw new Error('Para migrar seus dados para o Supabase, você precisa estar logado com uma conta no Supabase (clique em "Conectar Conta / Fazer Login").');
    }

    const targetUserId = authData.user.id;
    const errors: string[] = [];

    // 2. Coleta dados locais
    const localCategories = await this.getCategories();
    const localAccounts = await this.getAccounts();
    const localTransactions = await this.getTransactions();
    const localBudgets = await this.getBudgets();
    const localGoals = await this.getGoals();

    // 3. Mapeamento de IDs locais para UUIDs válidos no PostgreSQL
    const categoryIdMap = new Map<string, string>();
    const accountIdMap = new Map<string, string>();

    // 4. Insere Categorias
    let categoriesMigrated = 0;
    try {
      const categoriesPayload = localCategories.map(c => {
        const newCatId = isValidUUID(c.id) ? c.id : createUUID();
        categoryIdMap.set(c.id, newCatId);
        return {
          id: newCatId,
          user_id: targetUserId,
          name: c.name,
          slug: c.slug || c.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
          icon: c.icon || 'tag',
          color: c.color || '#820AD1',
          type: c.type || 'expense',
          monthly_budget_cap: Number(c.monthly_budget_cap || 0),
        };
      });

      if (categoriesPayload.length > 0) {
        const { error: catErr } = await client
          .from('categories')
          .upsert(categoriesPayload, { onConflict: 'user_id, name, type' });
        if (catErr) {
          console.warn('Erro ao inserir categorias:', catErr);
          errors.push(`Categorias: ${catErr.message}`);
        } else {
          categoriesMigrated = categoriesPayload.length;
        }
      }
    } catch (e: any) {
      errors.push(`Falha nas categorias: ${e.message}`);
    }

    // 5. Insere Contas e Cartões
    let accountsMigrated = 0;
    try {
      const accountsPayload = localAccounts.map(a => {
        const newAccId = isValidUUID(a.id) ? a.id : createUUID();
        accountIdMap.set(a.id, newAccId);
        return {
          id: newAccId,
          user_id: targetUserId,
          name: a.name,
          type: a.type,
          institution: a.institution || 'Nubank',
          balance: Number(a.balance || 0),
          credit_limit: Number(a.credit_limit || 0),
          closing_day: a.closing_day || null,
          due_day: a.due_day || null,
          color: a.color || '#820AD1',
          icon: a.icon || 'credit-card',
          is_active: a.is_active !== false,
        };
      });

      if (accountsPayload.length > 0) {
        const { error: accErr } = await client
          .from('accounts_and_cards')
          .upsert(accountsPayload);
        if (accErr) {
          console.warn('Erro ao inserir contas:', accErr);
          errors.push(`Contas: ${accErr.message}`);
        } else {
          accountsMigrated = accountsPayload.length;
        }
      }
    } catch (e: any) {
      errors.push(`Falha nas contas: ${e.message}`);
    }

    // 6. Insere Transações
    let transactionsMigrated = 0;
    try {
      if (localTransactions.length > 0) {
        const transactionsPayload = localTransactions.map(t => ({
          id: isValidUUID(t.id) ? t.id : createUUID(),
          user_id: targetUserId,
          account_id: (t.account_id && accountIdMap.get(t.account_id)) || (isValidUUID(t.account_id) ? t.account_id : null),
          category_id: (t.category_id && categoryIdMap.get(t.category_id)) || (isValidUUID(t.category_id) ? t.category_id : null),
          category_name: t.category_name || null,
          date: t.date,
          description: t.description,
          original_title: t.original_title || null,
          amount: Number(t.amount || 0),
          type: t.type,
          status: t.status || 'completed',
          installment_current: t.installment_current || null,
          installment_total: t.installment_total || null,
          is_recurring: Boolean(t.is_recurring),
          imported_via_csv: Boolean(t.imported_via_csv),
          csv_hash: t.csv_hash || null,
          notes: t.notes || null,
        }));

        // Inserção em lotes de 100 para evitar timeout
        const chunkSize = 100;
        for (let i = 0; i < transactionsPayload.length; i += chunkSize) {
          const chunk = transactionsPayload.slice(i, i + chunkSize);
          const { error: txErr } = await client.from('transactions').upsert(chunk);
          if (txErr) {
            console.warn('Erro no lote de transações:', txErr);
            errors.push(`Transações (lote ${i}): ${txErr.message}`);
          } else {
            transactionsMigrated += chunk.length;
          }
        }
      }
    } catch (e: any) {
      errors.push(`Falha nas transações: ${e.message}`);
    }

    // 7. Insere Orçamentos Mensais
    let budgetsMigrated = 0;
    try {
      const validBudgets = localBudgets
        .map(b => {
          const mappedCatId = categoryIdMap.get(b.category_id) || (isValidUUID(b.category_id) ? b.category_id : null);
          if (!mappedCatId) return null;
          return {
            id: isValidUUID(b.id) ? b.id : createUUID(),
            user_id: targetUserId,
            category_id: mappedCatId,
            year: Number(b.year),
            month: Number(b.month),
            budgeted_amount: Number(b.budgeted_amount || 0),
            alert_threshold_percentage: Number(b.alert_threshold_percentage || 85),
          };
        })
        .filter(Boolean);

      if (validBudgets.length > 0) {
        const { error: bgErr } = await client
          .from('monthly_budgets')
          .upsert(validBudgets as any, { onConflict: 'user_id, category_id, year, month' });
        if (bgErr) {
          console.warn('Erro orçamentos:', bgErr);
          errors.push(`Orçamentos: ${bgErr.message}`);
        } else {
          budgetsMigrated = validBudgets.length;
        }
      }
    } catch (e: any) {
      errors.push(`Falha nos orçamentos: ${e.message}`);
    }

    // 8. Insere Metas Financeiras
    let goalsMigrated = 0;
    try {
      const goalsPayload = localGoals.map(g => ({
        id: isValidUUID(g.id) ? g.id : createUUID(),
        user_id: targetUserId,
        title: g.title,
        description: g.description || null,
        target_amount: Number(g.target_amount || 0),
        current_amount: Number(g.current_amount || 0),
        monthly_contribution: Number(g.monthly_contribution || 0),
        deadline_date: g.deadline_date || null,
        color: g.color || '#10b981',
        is_completed: Boolean(g.is_completed),
      }));

      if (goalsPayload.length > 0) {
        const { error: goalErr } = await client.from('financial_goals').upsert(goalsPayload);
        if (goalErr) {
          console.warn('Erro metas:', goalErr);
          errors.push(`Metas: ${goalErr.message}`);
        } else {
          goalsMigrated = goalsPayload.length;
        }
      }
    } catch (e: any) {
      errors.push(`Falha nas metas: ${e.message}`);
    }

    // 9. REMOVE TODAS AS INFORMAÇÕES DO BANCO LOCAL
    let localDataWiped = false;
    if (errors.length === 0 || transactionsMigrated > 0 || accountsMigrated > 0) {
      this.wipeAllLocalDatabase();
      localDataWiped = true;
    }

    return {
      success: errors.length === 0,
      categoriesMigrated,
      accountsMigrated,
      transactionsMigrated,
      budgetsMigrated,
      goalsMigrated,
      errors,
      localDataWiped,
    };
  }

  /**
   * Remove todas as informações financeiras e coleções do armazenamento local (LocalStorage)
   */
  public static wipeAllLocalDatabase(): void {
    if (typeof window === 'undefined') return;

    try {
      const keysToRemove: string[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key) continue;
        // Identifica chaves locais de dados financeiros
        if (
          key.startsWith('gf_u_') ||
          key.startsWith('gf_clean_') ||
          key === 'gf_system_users_v3' ||
          key === 'gf_system_initialized_v3'
        ) {
          keysToRemove.push(key);
        }
      }

      keysToRemove.forEach(k => localStorage.removeItem(k));
      localStorage.setItem(STORAGE_KEYS.DATA_MODE, 'cloud');
      console.log(`Banco local limpo com sucesso: ${keysToRemove.length} chaves removidas.`);
    } catch (err) {
      console.error('Erro ao limpar banco de dados local:', err);
    }
  }

  static async clearAllData(): Promise<void> {
    this.wipeAllLocalDatabase();
    if (typeof window !== 'undefined') {
      const uid = this.getActiveUserId();
      this.initUserStore(uid);
    }
  }

  static async syncLocalDataToCloud(): Promise<{ transactionsSynced: number; accountsSynced: number }> {
    const res = await this.migrateAllLocalDataToSupabase();
    return {
      accountsSynced: res.accountsMigrated,
      transactionsSynced: res.transactionsMigrated
    };
  }
}
