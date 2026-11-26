-- Multi-card support: the user's credit cards (Nubank, Inter, Itaú, Bradesco...),
-- the card each transaction / import batch belongs to, and the generic
-- `credit_card` payment method replacing the Nubank-only `nubank_card`.

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

-- `nubank_card` stays accepted so clients still running the previous build keep working.
alter table public.transactions drop constraint if exists transactions_payment_method_check;
alter table public.transactions alter column payment_method set default 'credit_card';
alter table public.transactions add constraint transactions_payment_method_check
  check (payment_method in ('credit_card', 'nubank_card', 'pix_debit', 'cash', 'boleto'));

-- Backfill: every user that already had Nubank card entries gets a "Nubank" card
-- and those entries (and their import batches) are linked to it.
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
