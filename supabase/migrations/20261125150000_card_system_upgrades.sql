-- ============================================================================
-- Credit Card System Upgrades:
--   1. Card metadata: brand, is_default, is_archived, parent_card_id (virtual/additional),
--      holder_name, cashback_rate, points_per_dollar, annual_fee, waiver_monthly_spend
--   2. International transactions: original_currency, original_amount, iof_amount
-- Additive only: preserves all existing rows and defaults cleanly.
-- ============================================================================

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

