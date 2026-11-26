-- ============================================================================
-- Meu Pet Module:
--   1. public.pets table (name, species, breed, birth_date, weight_kg,
--      monthly_budget, color, notes, is_archived) with per-user RLS
--   2. transactions.pet_id & transactions.pet_expense_kind columns
-- Additive only: preserves all existing data cleanly.
-- ============================================================================

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

