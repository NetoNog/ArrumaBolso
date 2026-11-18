-- Salary / income management: recurring income sources (salary, freelance,
-- benefits...) and the link from each received income entry to its source.
-- Additive only: no existing column or row is changed.

create table if not exists public.income_sources (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 120),
  kind text not null default 'salary' check (kind in ('salary', 'freelance', 'benefit', 'other')),
  expected_amount numeric(12, 2) not null check (expected_amount >= 0),
  pay_day smallint not null default 5 check (pay_day between 1 and 31),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists income_sources_user_idx on public.income_sources (user_id);

alter table public.transactions
  add column if not exists income_source_id uuid references public.income_sources (id) on delete set null;
-- Covers the foreign key: deleting a source (ON DELETE SET NULL) would otherwise scan transactions.
create index if not exists transactions_income_source_idx
  on public.transactions (income_source_id) where income_source_id is not null;

revoke all on table public.income_sources from anon;
grant select, insert, update, delete on table public.income_sources to authenticated;

alter table public.income_sources enable row level security;
drop policy if exists "income_sources_owner" on public.income_sources;
create policy "income_sources_owner" on public.income_sources
  for all to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
