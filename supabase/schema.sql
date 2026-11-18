-- ============================================================================
-- ArrumaBolso — Supabase / PostgreSQL schema
--
-- Every table is isolated per user through Row Level Security on auth.uid().
-- New accounts start empty: the user feeds the system with their own data.
-- ============================================================================

create extension if not exists pgcrypto;

-- ------------------------------------------------------------------ profiles
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Minha Carteira',
  closing_day smallint not null default 2 check (closing_day between 1 and 28),
  monthly_income numeric(12, 2) not null default 0 check (monthly_income >= 0),
  dismissed_alerts text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- categories
create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon text not null default 'tag',
  monthly_limit numeric(12, 2) not null default 0 check (monthly_limit >= 0),
  created_at timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories (user_id);

-- ------------------------------------------------------------ import_batches
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  filename text not null,
  invoice_month char(7) not null check (invoice_month ~ '^\d{4}-\d{2}$'),
  new_count integer not null default 0 check (new_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  protected_count integer not null default 0 check (protected_count >= 0),
  replaced_projection_ids uuid[] not null default '{}',
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists import_batches_user_idx on public.import_batches (user_id, created_at desc);

-- -------------------------------------------------- recurring_subscriptions
create table if not exists public.recurring_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  expected_amount numeric(12, 2) not null check (expected_amount >= 0),
  category_id uuid references public.categories (id) on delete set null,
  billing_day smallint not null default 1 check (billing_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists recurring_subscriptions_user_idx on public.recurring_subscriptions (user_id);
create index if not exists recurring_subscriptions_category_idx on public.recurring_subscriptions (category_id) where category_id is not null;

-- -------------------------------------------------------------- transactions
create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  batch_id uuid references public.import_batches (id) on delete set null,
  date date not null,
  invoice_month char(7) not null check (invoice_month ~ '^\d{4}-\d{2}$'),
  raw_title text not null,
  clean_title text not null,
  amount numeric(12, 2) not null,
  type text not null check (type in ('expense', 'income', 'payment')),
  payment_method text not null default 'nubank_card'
    check (payment_method in ('nubank_card', 'pix_debit', 'cash', 'boleto')),
  category_id uuid references public.categories (id) on delete set null,
  source text not null check (source in ('csv', 'manual', 'projected')),
  is_user_edited boolean not null default false,
  locked_fields text[] not null default '{}',
  is_ignored boolean not null default false,
  subscription_id uuid references public.recurring_subscriptions (id) on delete set null,
  notes text not null default '',
  installment_group_id text,
  installment_current smallint check (installment_current is null or installment_current >= 1),
  installment_total smallint check (installment_total is null or installment_total >= 1),
  unique_hash char(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_installment_order
    check (installment_current is null or installment_total is null or installment_current <= installment_total)
);
-- unique_hash is unique per user (manual/projected rows have no hash).
create unique index if not exists transactions_user_hash_uidx
  on public.transactions (user_id, unique_hash) where unique_hash is not null;
create index if not exists transactions_user_month_idx on public.transactions (user_id, invoice_month);
create index if not exists transactions_installment_idx
  on public.transactions (user_id, installment_group_id) where installment_group_id is not null;
create index if not exists transactions_batch_idx on public.transactions (batch_id) where batch_id is not null;
create index if not exists transactions_category_idx on public.transactions (category_id) where category_id is not null;
create index if not exists transactions_subscription_idx on public.transactions (subscription_id) where subscription_id is not null;

-- ------------------------------------------------------- deleted_csv_hashes
-- Blacklist: CSV rows deleted by the user never come back on re-import.
create table if not exists public.deleted_csv_hashes (
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  unique_hash char(64) not null,
  raw_title text not null,
  deleted_at timestamptz not null default now(),
  primary key (user_id, unique_hash)
);

-- ----------------------------------------------------- categorization_rules
create table if not exists public.categorization_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  pattern text not null check (char_length(pattern) between 1 and 120),
  clean_name_override text,
  category_id uuid references public.categories (id) on delete set null,
  priority integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists categorization_rules_user_idx on public.categorization_rules (user_id, priority desc);
create index if not exists categorization_rules_category_idx on public.categorization_rules (category_id) where category_id is not null;

-- ------------------------------------------------------------ updated_at
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_touch on public.profiles;
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- ------------------------------------------------- profile on user signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id) on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Trigger-only function: nobody should be able to call it through the API.
revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------ Data API exposure
-- New tables are no longer exposed to the Data API automatically: grant the
-- signed-in role explicitly. Anonymous visitors get nothing; RLS below limits
-- authenticated users to their own rows.
revoke all on table
  public.profiles, public.categories, public.import_batches, public.recurring_subscriptions,
  public.transactions, public.deleted_csv_hashes, public.categorization_rules
from anon;

grant select, insert, update, delete on table
  public.profiles, public.categories, public.import_batches, public.recurring_subscriptions,
  public.transactions, public.deleted_csv_hashes, public.categorization_rules
to authenticated;

-- ------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.import_batches enable row level security;
alter table public.recurring_subscriptions enable row level security;
alter table public.transactions enable row level security;
alter table public.deleted_csv_hashes enable row level security;
alter table public.categorization_rules enable row level security;

drop policy if exists "profiles_owner" on public.profiles;
create policy "profiles_owner" on public.profiles
  for all to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

do $$
declare
  t text;
begin
  foreach t in array array[
    'categories', 'import_batches', 'recurring_subscriptions',
    'transactions', 'deleted_csv_hashes', 'categorization_rules'
  ]
  loop
    execute format('drop policy if exists "%s_owner" on public.%I', t, t);
    execute format(
      'create policy "%s_owner" on public.%I for all to authenticated '
      'using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)',
      t, t
    );
  end loop;
end;
$$;
