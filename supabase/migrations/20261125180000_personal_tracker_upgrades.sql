-- ============================================================================
-- Personal Finance Tracker Upgrades:
--   1. Subcategories & 50/30/20 nature on categories (parent_id, nature)
--   2. Accounts & Wallets table (public.accounts) + account_id / transfer_account_id on transactions
--   3. Quick templates / 1-click favorites table (public.quick_templates)
--   4. Receipts (receipt_path) & detailed line_items jsonb on transactions
--   5. Private Supabase Storage bucket `receipts` with per-user RLS policies
-- Additive only: preserves all existing data and defaults cleanly.
-- ============================================================================

-- ---------------------------------------------------------------- categories
alter table public.categories
  add column if not exists parent_id uuid references public.categories (id) on delete set null,
  add column if not exists nature text not null default 'lifestyle'
    check (nature in ('essential', 'lifestyle', 'financial'));

create index if not exists categories_parent_idx
  on public.categories (parent_id) where parent_id is not null;

-- ------------------------------------------------------------------ accounts
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'checking'
    check (kind in ('checking', 'cash', 'savings', 'voucher', 'investment')),
  initial_balance numeric(12, 2) not null default 0,
  color text not null default '#2563EB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts (user_id);

revoke all on table public.accounts from anon;
grant select, insert, update, delete on table public.accounts to authenticated;
alter table public.accounts enable row level security;

drop policy if exists "accounts_owner" on public.accounts;
create policy "accounts_owner" on public.accounts
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- -------------------------------------------------------------- transactions
alter table public.transactions
  add column if not exists account_id uuid references public.accounts (id) on delete set null,
  add column if not exists transfer_account_id uuid references public.accounts (id) on delete set null,
  add column if not exists receipt_path text,
  add column if not exists line_items jsonb not null default '[]'::jsonb;

create index if not exists transactions_account_idx
  on public.transactions (account_id) where account_id is not null;
create index if not exists transactions_transfer_account_idx
  on public.transactions (transfer_account_id) where transfer_account_id is not null;

-- ----------------------------------------------------------- quick_templates
create table if not exists public.quick_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  amount numeric(12, 2) not null check (amount > 0),
  type text not null default 'expense' check (type in ('expense', 'income')),
  payment_method text not null default 'pix_debit'
    check (payment_method in ('credit_card', 'pix_debit', 'cash', 'boleto')),
  category_id uuid references public.categories (id) on delete set null,
  card_id uuid references public.cards (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  tags text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index if not exists quick_templates_user_idx on public.quick_templates (user_id);

revoke all on table public.quick_templates from anon;
grant select, insert, update, delete on table public.quick_templates to authenticated;
alter table public.quick_templates enable row level security;

drop policy if exists "quick_templates_owner" on public.quick_templates;
create policy "quick_templates_owner" on public.quick_templates
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- --------------------------------------------------- storage bucket: receipts
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'receipts',
  'receipts',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "receipts_owner_select" on storage.objects;
create policy "receipts_owner_select" on storage.objects
  for select to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipts_owner_insert" on storage.objects;
create policy "receipts_owner_insert" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

drop policy if exists "receipts_owner_delete" on storage.objects;
create policy "receipts_owner_delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

