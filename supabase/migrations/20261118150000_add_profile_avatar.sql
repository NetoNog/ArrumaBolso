-- Profile picture: a DiceBear avatar described by its style id and seed.
-- Additive only: both columns are nullable (null = show the initials).

alter table public.profiles
  add column if not exists avatar_style text check (avatar_style is null or avatar_style ~ '^[a-z0-9-]{1,40}$'),
  add column if not exists avatar_seed text check (avatar_seed is null or char_length(avatar_seed) between 1 and 120);
