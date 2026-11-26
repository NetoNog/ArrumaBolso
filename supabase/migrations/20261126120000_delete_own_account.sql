-- Lets a signed-in user permanently delete their own account (LGPD right to erasure).
-- Every public table references auth.users with ON DELETE CASCADE, so removing the
-- auth user removes all of their financial data. Receipt files in Storage are not
-- covered by the cascade: the client removes them through the Storage API first.
create or replace function public.delete_own_account()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_user_id uuid := auth.uid();
begin
  if current_user_id is null then
    raise exception 'Not authenticated' using errcode = '28000';
  end if;

  delete from auth.users where id = current_user_id;
end;
$$;

revoke all on function public.delete_own_account() from public, anon;
grant execute on function public.delete_own_account() to authenticated;
