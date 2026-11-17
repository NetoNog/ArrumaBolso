-- Cover foreign keys flagged by the performance advisor: deleting a category or
-- subscription (ON DELETE SET NULL) would otherwise scan the referencing tables.
create index if not exists transactions_category_idx on public.transactions (category_id) where category_id is not null;
create index if not exists transactions_subscription_idx on public.transactions (subscription_id) where subscription_id is not null;
create index if not exists recurring_subscriptions_category_idx on public.recurring_subscriptions (category_id) where category_id is not null;
create index if not exists categorization_rules_category_idx on public.categorization_rules (category_id) where category_id is not null;
