import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export function isSupabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

let browserClient: SupabaseClient | null = null;

/** Browser Supabase client, or `null` when the env vars are not configured. */
export function getSupabaseBrowserClient(): SupabaseClient | null {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  browserClient ??= createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
  return browserClient;
}
