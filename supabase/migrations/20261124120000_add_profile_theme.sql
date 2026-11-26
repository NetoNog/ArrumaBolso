-- Per-user colour theme: the light/dark choice belongs to the account, not to
-- the browser, so it never leaks to another user or to the public pages.
-- Additive only: existing profiles default to the light theme.

alter table public.profiles
  add column if not exists theme text not null default 'light' check (theme in ('light', 'dark'));
