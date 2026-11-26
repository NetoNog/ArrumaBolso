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
  -- Profile picture: DiceBear style id + seed (null = initials).
  avatar_style text check (avatar_style is null or avatar_style ~ '^[a-z0-9-]{1,40}$'),
  avatar_seed text check (avatar_seed is null or char_length(avatar_seed) between 1 and 120),
  -- Colour theme of the signed-in app (per account, never per browser).
  theme text not null default 'light' check (theme in ('light', 'dark')),
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
  parent_id uuid references public.categories (id) on delete set null,
  nature text not null default 'lifestyle' check (nature in ('essential', 'lifestyle', 'financial')),
  created_at timestamptz not null default now()
);
create index if not exists categories_user_idx on public.categories (user_id);
create index if not exists categories_parent_idx on public.categories (parent_id) where parent_id is not null;

-- ------------------------------------------------------------------ accounts
create table if not exists public.accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  kind text not null default 'checking' check (kind in ('checking', 'cash', 'savings', 'voucher', 'investment')),
  initial_balance numeric(12, 2) not null default 0,
  color text not null default '#2563EB' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists accounts_user_idx on public.accounts (user_id);

-- ---------------------------------------------------------------------- pets
create table if not exists public.pets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  species text not null default 'dog'
    check (species in ('dog', 'cat', 'bird', 'rodent', 'reptile', 'fish', 'other')),
  breed text not null default '' check (char_length(breed) <= 80),
  birth_date date,
  weight_kg numeric(6, 2) check (weight_kg is null or weight_kg >= 0),
  monthly_budget numeric(12, 2) not null default 0 check (monthly_budget >= 0),
  color text not null default '#F59E0B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  notes text not null default '',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists pets_user_idx on public.pets (user_id);

-- --------------------------------------------------------------------- cards
-- The user's credit cards; statements imported from each bank point to one.
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  issuer text not null check (issuer in ('nubank', 'inter', 'itau', 'bradesco', 'santander', 'c6', 'bb', 'caixa', 'xp', 'other')),
  brand text check (brand is null or brand in ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other')),
  last_four char(4) check (last_four is null or last_four ~ '^\d{4}$'),
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  closing_day smallint check (closing_day is null or closing_day between 1 and 28),
  due_day smallint check (due_day is null or due_day between 1 and 31),
  credit_limit numeric(12, 2) check (credit_limit is null or credit_limit >= 0),
  is_default boolean not null default false,
  is_archived boolean not null default false,
  parent_card_id uuid references public.cards (id) on delete set null,
  holder_name text check (holder_name is null or char_length(holder_name) <= 60),
  cashback_rate numeric(5, 2) check (cashback_rate is null or cashback_rate between 0 and 100),
  points_per_dollar numeric(6, 2) check (points_per_dollar is null or points_per_dollar >= 0),
  annual_fee numeric(12, 2) check (annual_fee is null or annual_fee >= 0),
  waiver_monthly_spend numeric(12, 2) check (waiver_monthly_spend is null or waiver_monthly_spend >= 0),
  created_at timestamptz not null default now()
);
create index if not exists cards_user_idx on public.cards (user_id);
create index if not exists cards_parent_idx on public.cards (parent_card_id) where parent_card_id is not null;

-- ------------------------------------------------------------ import_batches
create table if not exists public.import_batches (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  filename text not null,
  invoice_month char(7) not null check (invoice_month ~ '^\d{4}-\d{2}$'),
  card_id uuid references public.cards (id) on delete set null,
  new_count integer not null default 0 check (new_count >= 0),
  skipped_count integer not null default 0 check (skipped_count >= 0),
  protected_count integer not null default 0 check (protected_count >= 0),
  replaced_projection_ids uuid[] not null default '{}',
  undone_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists import_batches_user_idx on public.import_batches (user_id, created_at desc);
create index if not exists import_batches_card_idx on public.import_batches (card_id) where card_id is not null;

-- -------------------------------------------------- recurring_subscriptions
create table if not exists public.recurring_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  expected_amount numeric(12, 2) not null check (expected_amount >= 0),
  category_id uuid references public.categories (id) on delete set null,
  billing_day smallint not null default 1 check (billing_day between 1 and 31),
  active boolean not null default true,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'quarterly', 'semiannual', 'annual')),
  billing_month smallint check (billing_month is null or billing_month between 1 and 12),
  payment_method text not null default 'credit_card' check (payment_method in ('credit_card', 'pix_debit', 'cash', 'boleto')),
  card_id uuid references public.cards (id) on delete set null,
  created_at timestamptz not null default now()
);
create index if not exists recurring_subscriptions_user_idx on public.recurring_subscriptions (user_id);
create index if not exists recurring_subscriptions_category_idx on public.recurring_subscriptions (category_id) where category_id is not null;
create index if not exists recurring_subscriptions_card_idx on public.recurring_subscriptions (card_id) where card_id is not null;

-- ------------------------------------------------------------ income_sources
create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'salary' check (kind in ('salary', 'freelance', 'benefit', 'other')),
  expected_amount numeric(12, 2) not null check (expected_amount >= 0),
  pay_day smallint not null default 5 check (pay_day between 1 and 31),
  active boolean not null default true,
  frequency text not null default 'monthly' check (frequency in ('monthly', 'annual', 'once')),
  pay_month smallint check (pay_month is null or pay_month between 1 and 12),
  scheduled_month char(7) check (scheduled_month is null or scheduled_month ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now()
);
create index if not exists income_sources_user_idx on public.income_sources (user_id);

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
  payment_method text not null default 'credit_card'
    constraint transactions_payment_method_check
    check (payment_method in ('credit_card', 'nubank_card', 'pix_debit', 'cash', 'boleto')),
  card_id uuid references public.cards (id) on delete set null,
  account_id uuid references public.accounts (id) on delete set null,
  transfer_account_id uuid references public.accounts (id) on delete set null,
  category_id uuid references public.categories (id) on delete set null,
  source text not null check (source in ('csv', 'manual', 'projected')),
  is_user_edited boolean not null default false,
  locked_fields text[] not null default '{}',
  is_ignored boolean not null default false,
  subscription_id uuid references public.recurring_subscriptions (id) on delete set null,
  income_source_id uuid references public.income_sources (id) on delete set null,
  notes text not null default '',
  tags text[] not null default '{}',
  split_group_id text,
  refund_of_transaction_id uuid references public.transactions (id) on delete set null,
  original_currency text check (original_currency is null or original_currency ~ '^[A-Z]{3}$'),
  original_amount numeric(12, 2) check (original_amount is null or original_amount >= 0),
  iof_amount numeric(12, 2) check (iof_amount is null or iof_amount >= 0),
  receipt_path text,
  line_items jsonb not null default '[]'::jsonb,
  pet_id uuid references public.pets (id) on delete set null,
  pet_expense_kind text check (pet_expense_kind is null or pet_expense_kind in ('food', 'vet', 'grooming', 'meds', 'accessories', 'boarding', 'other')),
  installment_group_id text,
  installment_current smallint check (installment_current is null or installment_current >= 1),
  installment_total smallint check (installment_total is null or installment_total >= 1),
  unique_hash char(64),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint transactions_installment_order
    check (installment_current is null or installment_total is null or installment_current <= installment_total)
);
create unique index if not exists transactions_user_hash_uidx
  on public.transactions (user_id, unique_hash) where unique_hash is not null;
create index if not exists transactions_user_month_idx on public.transactions (user_id, invoice_month);
create index if not exists transactions_installment_idx
  on public.transactions (user_id, installment_group_id) where installment_group_id is not null;
create index if not exists transactions_split_group_idx
  on public.transactions (user_id, split_group_id) where split_group_id is not null;
create index if not exists transactions_refund_of_idx
  on public.transactions (refund_of_transaction_id) where refund_of_transaction_id is not null;
create index if not exists transactions_batch_idx on public.transactions (batch_id) where batch_id is not null;
create index if not exists transactions_category_idx on public.transactions (category_id) where category_id is not null;
create index if not exists transactions_subscription_idx on public.transactions (subscription_id) where subscription_id is not null;
create index if not exists transactions_income_source_idx on public.transactions (income_source_id) where income_source_id is not null;
create index if not exists transactions_card_idx on public.transactions (card_id) where card_id is not null;
create index if not exists transactions_account_idx on public.transactions (account_id) where account_id is not null;
create index if not exists transactions_transfer_account_idx on public.transactions (transfer_account_id) where transfer_account_id is not null;
create index if not exists transactions_pet_idx on public.transactions (pet_id) where pet_id is not null;

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

-- ------------------------------------------------------- deleted_csv_hashes
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
  is_regex boolean not null default false,
  min_amount numeric(12, 2) check (min_amount is null or min_amount >= 0),
  max_amount numeric(12, 2) check (max_amount is null or max_amount >= 0),
  payment_method text check (payment_method is null or payment_method in ('credit_card', 'pix_debit', 'cash', 'boleto')),
  subscription_id uuid references public.recurring_subscriptions (id) on delete set null,
  mark_ignored boolean not null default false,
  created_at timestamptz not null default now()
);
create index if not exists categorization_rules_user_idx on public.categorization_rules (user_id, priority desc);
create index if not exists categorization_rules_category_idx on public.categorization_rules (category_id) where category_id is not null;
create index if not exists categorization_rules_subscription_idx on public.categorization_rules (subscription_id) where subscription_id is not null;

-- ------------------------------------------------------------- savings_goals
create table if not exists public.savings_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 80),
  target_amount numeric(12, 2) not null check (target_amount > 0),
  current_amount numeric(12, 2) not null default 0 check (current_amount >= 0),
  monthly_contribution numeric(12, 2) not null default 0 check (monthly_contribution >= 0),
  target_month char(7) check (target_month is null or target_month ~ '^\d{4}-\d{2}$'),
  color text not null default '#10B981' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
create index if not exists savings_goals_user_idx on public.savings_goals (user_id);

-- --------------------------------------------------- invoice_reconciliations
create table if not exists public.invoice_reconciliations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  invoice_month char(7) not null check (invoice_month ~ '^\d{4}-\d{2}$'),
  card_id uuid references public.cards (id) on delete set null,
  expected_total numeric(12, 2) not null check (expected_total >= 0),
  status text not null default 'checked' check (status in ('checked', 'paid')),
  notes text not null default '',
  checked_at timestamptz not null default now()
);
create index if not exists invoice_reconciliations_user_idx on public.invoice_reconciliations (user_id, invoice_month);
create index if not exists invoice_reconciliations_card_idx on public.invoice_reconciliations (card_id) where card_id is not null;

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

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ------------------------------------------------------ Data API exposure
revoke all on table
  public.profiles, public.categories, public.accounts, public.pets, public.cards, public.import_batches, public.recurring_subscriptions,
  public.income_sources, public.transactions, public.quick_templates, public.deleted_csv_hashes, public.categorization_rules,
  public.savings_goals, public.invoice_reconciliations
from anon;

grant select, insert, update, delete on table
  public.profiles, public.categories, public.accounts, public.pets, public.cards, public.import_batches, public.recurring_subscriptions,
  public.income_sources, public.transactions, public.quick_templates, public.deleted_csv_hashes, public.categorization_rules,
  public.savings_goals, public.invoice_reconciliations
to authenticated;

-- ------------------------------------------------------- row level security
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.accounts enable row level security;
alter table public.pets enable row level security;
alter table public.cards enable row level security;
alter table public.import_batches enable row level security;
alter table public.recurring_subscriptions enable row level security;
alter table public.income_sources enable row level security;
alter table public.transactions enable row level security;
alter table public.quick_templates enable row level security;
alter table public.deleted_csv_hashes enable row level security;
alter table public.categorization_rules enable row level security;
alter table public.savings_goals enable row level security;
alter table public.invoice_reconciliations enable row level security;

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
    'categories', 'accounts', 'pets', 'cards', 'import_batches', 'recurring_subscriptions', 'income_sources',
    'transactions', 'quick_templates', 'deleted_csv_hashes', 'categorization_rules', 'savings_goals', 'invoice_reconciliations'
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
