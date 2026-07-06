-- ============================================================
-- FinhubKH Journal — Profiles + admin role
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists profiles (
  id            uuid primary key references auth.users on delete cascade,
  email         text not null,
  display_name  text,
  role          text not null default 'user' check (role in ('user', 'admin')),
  created_at    timestamptz default now()
);

create index if not exists profiles_role_idx on profiles(role);
create index if not exists profiles_email_idx on profiles(email);

alter table profiles enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  );
$$;

grant execute on function public.is_admin() to authenticated;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile"
  on profiles for select using (auth.uid() = id);

drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles"
  on profiles for select using (public.is_admin());

drop policy if exists "Users can update own profile display name" on profiles;
create policy "Users can update own profile display name"
  on profiles for update using (auth.uid() = id)
  with check (auth.uid() = id);

create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Service role / SQL editor (no JWT) may manage roles for seeding and ops
  if auth.uid() is not null and not public.is_admin() and new.role is distinct from old.role then
    raise exception 'Cannot change role';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard
  before update on profiles
  for each row execute function public.prevent_profile_role_escalation();

drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles"
  on profiles for update using (public.is_admin());

drop policy if exists "Admins can delete profiles" on profiles;
create policy "Admins can delete profiles"
  on profiles for delete using (public.is_admin());

-- Backfill profiles for existing auth users
insert into public.profiles (id, email, display_name, role)
select
  u.id,
  u.email,
  coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)),
  'user'
from auth.users u
on conflict (id) do update
  set email = excluded.email,
      display_name = coalesce(public.profiles.display_name, excluded.display_name);

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    'user'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Admin read/delete on app tables
drop policy if exists "Admins can view all trades" on trades;
create policy "Admins can view all trades"
  on trades for select using (public.is_admin());

drop policy if exists "Admins can delete all trades" on trades;
create policy "Admins can delete all trades"
  on trades for delete using (public.is_admin());

drop policy if exists "Admins can view all trading accounts" on trading_accounts;
create policy "Admins can view all trading accounts"
  on trading_accounts for select using (public.is_admin());

drop policy if exists "Admins can delete all trading accounts" on trading_accounts;
create policy "Admins can delete all trading accounts"
  on trading_accounts for delete using (public.is_admin());

drop policy if exists "Admins can view all sync keys" on sync_keys;
create policy "Admins can view all sync keys"
  on sync_keys for select using (public.is_admin());

drop policy if exists "Admins can delete all sync keys" on sync_keys;
create policy "Admins can delete all sync keys"
  on sync_keys for delete using (public.is_admin());

drop policy if exists "Admins can view all daily pnl" on daily_pnl;
create policy "Admins can view all daily pnl"
  on daily_pnl for select using (public.is_admin());

drop policy if exists "Admins can delete all daily pnl" on daily_pnl;
create policy "Admins can delete all daily pnl"
  on daily_pnl for delete using (public.is_admin());

drop policy if exists "Admins can view all checklist steps" on checklist_steps;
create policy "Admins can view all checklist steps"
  on checklist_steps for select using (public.is_admin());

drop policy if exists "Admins can view all entry models" on entry_models;
create policy "Admins can view all entry models"
  on entry_models for select using (public.is_admin());

-- Admin RPCs
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
    'total_trades', (select count(*)::int from trades),
    'api_trades', (select count(*)::int from trades where source = 'api'),
    'total_accounts', (select count(*)::int from trading_accounts),
    'active_sync_keys', (select count(*)::int from sync_keys),
    'total_pnl', coalesce((select sum(pnl_usd) from trades), 0)
  ) into result;

  return result;
end;
$$;

create or replace function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  trade_count bigint,
  account_count bigint,
  sync_key_count bigint,
  total_pnl numeric,
  last_trade_date date
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
    (select count(*)::bigint from trades t where t.user_id = p.id) as trade_count,
    (select count(*)::bigint from trading_accounts ta where ta.user_id = p.id) as account_count,
    (select count(*)::bigint from sync_keys sk where sk.user_id = p.id) as sync_key_count,
    coalesce((select sum(t.pnl_usd) from trades t where t.user_id = p.id), 0) as total_pnl,
    (select max(t.date) from trades t where t.user_id = p.id) as last_trade_date
  from profiles p
  order by p.created_at desc;
end;
$$;

create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if new_role not in ('user', 'admin') then
    raise exception 'Invalid role';
  end if;
  if target_user_id = auth.uid() and new_role <> 'admin' then
    raise exception 'Cannot demote yourself';
  end if;
  update profiles set role = new_role where id = target_user_id;
  if not found then
    raise exception 'User not found';
  end if;
end;
$$;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if target_user_id = auth.uid() then
    raise exception 'Cannot delete yourself';
  end if;
  delete from auth.users where id = target_user_id;
end;
$$;

grant execute on function public.admin_platform_stats() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
