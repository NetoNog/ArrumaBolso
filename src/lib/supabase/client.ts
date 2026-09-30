import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface SupabaseConfigInfo {
  url: string;
  key: string;
  source: 'env' | 'storage' | 'none';
}

export const cleanSupabaseUrl = (raw: string): string => {
  return raw.trim().replace(/\/rest\/v1\/?$/i, '').replace(/\/+$/, '');
};

export const getSupabaseConfig = (): SupabaseConfigInfo => {
  const envUrl = cleanSupabaseUrl(process.env.NEXT_PUBLIC_SUPABASE_URL || '');
  const envKey = (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').trim();

  if (envUrl && envKey && !envUrl.includes('placeholder') && envUrl.startsWith('https://')) {
    return { url: envUrl, key: envKey, source: 'env' };
  }

  if (typeof window !== 'undefined') {
    try {
      const localUrl = cleanSupabaseUrl(localStorage.getItem('gf_supabase_url') || '');
      const localKey = (localStorage.getItem('gf_supabase_anon_key') || '').trim();
      if (localUrl && localKey && !localUrl.includes('placeholder') && localUrl.startsWith('https://')) {
        return { url: localUrl, key: localKey, source: 'storage' };
      }
    } catch {
      // Ignore localStorage errors
    }
  }

  return { url: '', key: '', source: 'none' };
};

export const isSupabaseConfigured = (): boolean => {
  const config = getSupabaseConfig();
  return Boolean(config.url && config.key);
};

let cachedClient: SupabaseClient | null = null;
let cachedConfigKey = '';

export const getSupabase = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (!config.url || !config.key) {
    cachedClient = null;
    cachedConfigKey = '';
    return null;
  }

  const configKey = `${config.url}::${config.key}`;
  if (cachedClient && cachedConfigKey === configKey) {
    return cachedClient;
  }

  cachedClient = createClient(config.url, config.key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    }
  });
  cachedConfigKey = configKey;
  return cachedClient;
};

export const setSupabaseLocalConfig = (url: string, key: string) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem('gf_supabase_url', cleanSupabaseUrl(url));
    localStorage.setItem('gf_supabase_anon_key', key.trim());
  }
  cachedClient = null;
  cachedConfigKey = '';
};

export const clearSupabaseLocalConfig = () => {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('gf_supabase_url');
    localStorage.removeItem('gf_supabase_anon_key');
  }
  cachedClient = null;
  cachedConfigKey = '';
};

// Proxy para manter compatibilidade transparente com `supabase.from(...)` e `supabase.auth...`
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      return undefined;
    }
    const value = (client as any)[prop];
    return typeof value === 'function' ? value.bind(client) : value;
  }
});
