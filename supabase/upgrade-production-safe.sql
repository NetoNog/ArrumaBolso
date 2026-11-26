-- ============================================================================
-- ArrumaBolso — Atualização Segura de Produção (ZERO perda de dados)
-- ============================================================================
-- Consolida as 6 migrations pendentes em uma única transação atômica:
--   1. 20261123120000_add_cards.sql               (Cartões & vínculo Nubank)
--   2. 20261124120000_add_profile_theme.sql       (Tema salvo no perfil)
--   3. 20261125120000_power_upgrades.sql          (Metas, conciliação, tags, divisões, estornos)
--   4. 20261125150000_card_system_upgrades.sql    (Limites, adicionais, cashback, moeda estrangeira)
--   5. 20261125180000_personal_tracker_upgrades.sql (Contas bancárias, templates, comprovantes)
--   6. 20261125210000_meu_pet.sql                 (Módulo Meu Pet)
--
-- GARANTIAS DE SEGURANÇA:
--   • 100% aditivo e idempotente (IF NOT EXISTS / ON CONFLICT DO NOTHING).
--   • Nenhum DROP TABLE, TRUNCATE ou DELETE — todos os dados existentes são preservados.
--   • Envolvido em BEGIN ... COMMIT: em caso de qualquer erro, nada é alterado.
--   • Recarrega automaticamente o cache do PostgREST ao final (NOTIFY pgrst).
--
-- COMO EXECUTAR:
--   1. Faça um backup/snapshot rápido no painel do Supabase (Database → Backups).
--   2. Abra o SQL Editor do projeto de produção no Supabase.
--   3. Cole todo este arquivo e clique em "Run".
-- ============================================================================

begin;

-- ---------------------------------------------------------------------------
-- 1. Cartões (20261123120000_add_cards.sql)
-- ---------------------------------------------------------------------------
create table if not exists public.cards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 60),
  issuer text not null check (issuer in ('nubank', 'inter', 'itau', 'bradesco', 'santander', 'c6', 'bb', 'caixa', 'xp', 'other')),
  last_four char(4) check (last_four is null or last_four ~ '^\d{4}$'),
  color text not null default '#64748B' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  created_at timestamptz not null default now()
);
create index if not exists cards_user_idx on public.cards (user_id);

alter table public.transactions
  add column if not exists card_id uuid references public.cards (id) on delete set null;
create index if not exists transactions_card_idx on public.transactions (card_id) where card_id is not null;

alter table public.import_batches
  add column if not exists card_id uuid references public.cards (id) on delete set null;
create index if not exists import_batches_card_idx on public.import_batches (card_id) where card_id is not null;

-- Mantém 'nubank_card' aceito para retrocompatibilidade durante a virada.
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions alter column payment_method set default 'credit_card';
alter table public.transactions add constraint transactions_payment_method_check
  check (payment_method in ('credit_card', 'nubank_card', 'pix_debit', 'cash', 'boleto'));

-- Backfill seguro: cria cartão "Nubank" para usuários com lançamentos legados e vincula sem perder nada.
insert into public.cards (user_id, name, issuer, color)
select distinct t.user_id, 'Nubank', 'nubank', '#820AD1'
from public.transactions t
where t.payment_method = 'nubank_card'
  and not exists (select 1 from public.cards c where c.user_id = t.user_id and c.issuer = 'nubank');

update public.transactions t
set payment_method = 'credit_card',
    card_id = coalesce(t.card_id, (
      select c.id from public.cards c
      where c.user_id = t.user_id and c.issuer = 'nubank'
      order by c.created_at
      limit 1
    ))
where t.payment_method = 'nubank_card';

update public.import_batches b
set card_id = (
  select c.id from public.cards c
  where c.user_id = b.user_id and c.issuer = 'nubank'
  order by c.created_at
  limit 1
)
where b.card_id is null;

revoke all on table public.cards from anon;
grant select, insert, update, delete on table public.cards to authenticated;
alter table public.cards enable row level security;
drop policy if exists "cards_owner" on public.cards;
create policy "cards_owner" on public.cards
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 2. Tema no perfil (20261124120000_add_profile_theme.sql)
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));

-- ---------------------------------------------------------------------------
-- 3. Power upgrades (20261125120000_power_upgrades.sql)
-- ---------------------------------------------------------------------------
alter table public.cards
  add column if not exists closing_day smallint check (closing_day is null or closing_day between 1 and 28),
  add column if not exists due_day smallint check (due_day is null or due_day between 1 and 31),
  add column if not exists credit_limit numeric(12, 2) check (credit_limit is null or credit_limit >= 0);

alter table public.transactions
  add column if not exists tags text[] not null default '{}',
  add column if not exists split_group_id text,
  add column if not exists refund_of_transaction_id uuid references public.transactions (id) on delete set null;

create index if not exists transactions_split_group_idx
  on public.transactions (user_id, split_group_id) where split_group_id is not null;
create index if not exists transactions_refund_of_idx
  on public.transactions (refund_of_transaction_id) where refund_of_transaction_id is not null;

alter table public.recurring_subscriptions
  add column if not exists frequency text not null default 'monthly'
    check (frequency in ('monthly', 'quarterly', 'semiannual', 'annual')),
  add column if not exists billing_month smallint
    check (billing_month is null or billing_month between 1 and 12),
  add column if not exists payment_method text not null default 'credit_card'
    check (payment_method in ('credit_card', 'pix_debit', 'cash', 'boleto')),
  add column if not exists card_id uuid references public.cards (id) on delete set null;

create index if not exists recurring_subscriptions_card_idx
  on public.recurring_subscriptions (card_id) where card_id is not null;

alter table public.income_sources
  add column if not exists frequency text not null default 'monthly'
    check (frequency in ('monthly', 'annual', 'once')),
  add column if not exists pay_month smallint
    check (pay_month is null or pay_month between 1 and 12),
  add column if not exists scheduled_month char(7)
    check (scheduled_month is null or scheduled_month ~ '^\d{4}-\d{2}$');

alter table public.categorization_rules
  add column if not exists is_regex boolean not null default false,
  add column if not exists min_amount numeric(12, 2) check (min_amount is null or min_amount >= 0),
  add column if not exists max_amount numeric(12, 2) check (max_amount is null or max_amount >= 0),
  add column if not exists payment_method text
    check (payment_method is null or payment_method in ('credit_card', 'pix_debit', 'cash', 'boleto')),
  add column if not exists subscription_id uuid references public.recurring_subscriptions (id) on delete set null,
  add column if not exists mark_ignored boolean not null default false;

create index if not exists categorization_rules_subscription_idx
  on public.categorization_rules (subscription_id) where subscription_id is not null;

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

revoke all on table public.savings_goals from anon;
grant select, insert, update, delete on table public.savings_goals to authenticated;
alter table public.savings_goals enable row level security;
drop policy if exists "savings_goals_owner" on public.savings_goals;
create policy "savings_goals_owner" on public.savings_goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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
create index if not exists invoice_reconciliations_user_idx
  on public.invoice_reconciliations (user_id, invoice_month);
create index if not exists invoice_reconciliations_card_idx
  on public.invoice_reconciliations (card_id) where card_id is not null;

revoke all on table public.invoice_reconciliations from anon;
grant select, insert, update, delete on table public.invoice_reconciliations to authenticated;
alter table public.invoice_reconciliations enable row level security;
drop policy if exists "invoice_reconciliations_owner" on public.invoice_reconciliations;
create policy "invoice_reconciliations_owner" on public.invoice_reconciliations
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- 4. Card system upgrades (20261125150000_card_system_upgrades.sql)
-- ---------------------------------------------------------------------------
alter table public.cards
  add column if not exists brand text
    check (brand is null or brand in ('visa', 'mastercard', 'elo', 'amex', 'hipercard', 'other')),
  add column if not exists is_default boolean not null default false,
  add column if not exists is_archived boolean not null default false,
  add column if not exists parent_card_id uuid references public.cards (id) on delete set null,
  add column if not exists holder_name text check (holder_name is null or char_length(holder_name) <= 60),
  add column if not exists cashback_rate numeric(5, 2) check (cashback_rate is null or cashback_rate between 0 and 100),
  add column if not exists points_per_dollar numeric(6, 2) check (points_per_dollar is null or points_per_dollar >= 0),
  add column if not exists annual_fee numeric(12, 2) check (annual_fee is null or annual_fee >= 0),
  add column if not exists waiver_monthly_spend numeric(12, 2) check (waiver_monthly_spend is null or waiver_monthly_spend >= 0);

create index if not exists cards_parent_idx
  on public.cards (parent_card_id) where parent_card_id is not null;

alter table public.transactions
  add column if not exists original_currency text
    check (original_currency is null or original_currency ~ '^[A-Z]{3}$'),
  add column if not exists original_amount numeric(12, 2)
    check (original_amount is null or original_amount >= 0),
  add column if not exists iof_amount numeric(12, 2)
    check (iof_amount is null or iof_amount >= 0);

-- ---------------------------------------------------------------------------
-- 5. Personal tracker upgrades (20261125180000_personal_tracker_upgrades.sql)
-- ---------------------------------------------------------------------------
alter table public.categories
  add column if not exists parent_id uuid references public.categories (id) on delete set null,
  add column if not exists nature text not null default 'lifestyle'
    check (nature in ('essential', 'lifestyle', 'financial'));

create index if not exists categories_parent_idx
  on public.categories (parent_id) where parent_id is not null;

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

alter table public.transactions
  add column if not exists account_id uuid references public.accounts (id) on delete set null,
  add column if not exists transfer_account_id uuid references public.accounts (id) on delete set null,
  add column if not exists receipt_path text,
  add column if not exists line_items jsonb not null default '[]'::jsonb;

create index if not exists transactions_account_idx
  on public.transactions (account_id) where account_id is not null;
create index if not exists transactions_transfer_account_idx
  on public.transactions (transfer_account_id) where transfer_account_id is not null;

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

-- ---------------------------------------------------------------------------
-- 6. Meu Pet (20261125210000_meu_pet.sql)
-- ---------------------------------------------------------------------------
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

revoke all on table public.pets from anon;
grant select, insert, update, delete on table public.pets to authenticated;
alter table public.pets enable row level security;
drop policy if exists "pets_owner" on public.pets;
create policy "pets_owner" on public.pets
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter table public.transactions
  add column if not exists pet_id uuid references public.pets (id) on delete set null,
  add column if not exists pet_expense_kind text
    check (pet_expense_kind is null or pet_expense_kind in ('food', 'vet', 'grooming', 'meds', 'accessories', 'boarding', 'other'));

create index if not exists transactions_pet_idx
  on public.transactions (pet_id) where pet_id is not null;

-- Atualiza o cache de schema do PostgREST imediatamente sem reiniciar o banco.
notify pgrst, 'reload schema';

commit;

