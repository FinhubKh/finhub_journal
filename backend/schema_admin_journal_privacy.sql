-- ============================================================
-- FinhubKH Journal — Admin journal privacy
-- Run in Supabase SQL Editor after schema_profiles_admin.sql
-- Admins can manage users/accounts/sync keys but not read journals.
-- ============================================================

-- Remove admin access to private journal data
drop policy if exists "Admins can view all trades" on trades;
drop policy if exists "Admins can delete all trades" on trades;
drop policy if exists "Admins can view all daily pnl" on daily_pnl;
drop policy if exists "Admins can delete all daily pnl" on daily_pnl;
drop policy if exists "Admins can view all checklist steps" on checklist_steps;
drop policy if exists "Admins can view all entry models" on entry_models;

-- Platform stats without financial journal data
create or replace function public.admin_platform_stats()
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  result json;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  select json_build_object(
    'total_users', (select count(*)::int from profiles),
    'admin_users', (select count(*)::int from profiles where role = 'admin'),
    'total_accounts', (select count(*)::int from trading_accounts),
    'active_sync_keys', (select count(*)::int from sync_keys)
  ) into result;

  return result;
end;
$$;

-- User list without per-user PnL or trade dates
create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  account_count bigint,
  sync_key_count bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;

  return query
  select
    p.id,
    p.email,
    p.display_name,
    p.role,
    p.created_at,
    (select count(*)::bigint from trading_accounts ta where ta.user_id = p.id) as account_count,
    (select count(*)::bigint from sync_keys sk where sk.user_id = p.id) as sync_key_count
  from profiles p
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_platform_stats() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
