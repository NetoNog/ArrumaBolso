-- ============================================================================
-- Power upgrades:
--   1. Multi-card cycle & limit: closing_day, due_day, credit_limit on cards
--   2. Transactions: tags[], split_group_id, refund_of_transaction_id
--   3. Fixed bills / subscriptions: frequency, billing_month, payment_method, card_id
--   4. Seasonal / extra income: frequency, pay_month, scheduled_month on income_sources
--   5. Smarter categorization rules: is_regex, min_amount, max_amount,
--      payment_method, subscription_id, mark_ignored
--   6. Savings goals table (public.savings_goals)
--   7. Invoice reconciliations table (public.invoice_reconciliations)
-- Additive only: preserves all existing rows and defaults cleanly.
-- ============================================================================

-- --------------------------------------------------------------------- cards
alter table public.cards
  add column if not exists closing_day smallint check (closing_day is null or closing_day between 1 and 28),
  add column if not exists due_day smallint check (due_day is null or due_day between 1 and 31),
  add column if not exists credit_limit numeric(12, 2) check (credit_limit is null or credit_limit >= 0);

-- -------------------------------------------------------------- transactions
alter table public.transactions
  add column if not exists tags text[] not null default '{}',
  add column if not exists split_group_id text,
  add column if not exists refund_of_transaction_id uuid references public.transactions (id) on delete set null;

create index if not exists transactions_split_group_idx
  on public.transactions (user_id, split_group_id) where split_group_id is not null;
create index if not exists transactions_refund_of_idx
  on public.transactions (refund_of_transaction_id) where refund_of_transaction_id is not null;

-- -------------------------------------------------- recurring_subscriptions
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

-- ------------------------------------------------------------ income_sources
alter table public.income_sources
  add column if not exists frequency text not null default 'monthly'
    check (frequency in ('monthly', 'annual', 'once')),
  add column if not exists pay_month smallint
    check (pay_month is null or pay_month between 1 and 12),
  add column if not exists scheduled_month char(7)
    check (scheduled_month is null or scheduled_month ~ '^\d{4}-\d{2}$');

-- ----------------------------------------------------- categorization_rules
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

revoke all on table public.savings_goals from anon;
grant select, insert, update, delete on table public.savings_goals to authenticated;
alter table public.savings_goals enable row level security;

drop policy if exists "savings_goals_owner" on public.savings_goals;
create policy "savings_goals_owner" on public.savings_goals
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

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

