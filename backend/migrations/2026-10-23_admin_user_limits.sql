-- Admin-controlled creation limits: platform defaults + optional per-user overrides.
-- Replaces the hardcoded caps in 2026-09-18_trading_account_limit.sql (2) and
-- 2026-10-08_backtest_limit.sql (12).
-- Run in Supabase SQL Editor or: supabase db query --linked -f backend/migrations/2026-10-23_admin_user_limits.sql

-- ── Platform defaults (singleton) ──
create table if not exists public.app_limits (
  id int primary key default 1 check (id = 1),
  max_trading_accounts int not null default 2
    check (max_trading_accounts >= 0 and max_trading_accounts <= 1000),
  max_backtests int not null default 12
    check (max_backtests >= 0 and max_backtests <= 1000),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

insert into public.app_limits (id)
values (1)
on conflict (id) do nothing;

alter table public.app_limits enable row level security;

grant select on public.app_limits to authenticated;
grant all on public.app_limits to service_role;

drop policy if exists "Authenticated can read app_limits" on public.app_limits;
create policy "Authenticated can read app_limits"
  on public.app_limits for select
  to authenticated
  using (true);

-- ── Per-user overrides (null column = use platform default) ──
create table if not exists public.user_limits (
  user_id uuid primary key references auth.users(id) on delete cascade,
  max_trading_accounts int
    check (max_trading_accounts is null or (max_trading_accounts >= 0 and max_trading_accounts <= 1000)),
  max_backtests int
    check (max_backtests is null or (max_backtests >= 0 and max_backtests <= 1000)),
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.user_limits enable row level security;

grant select on public.user_limits to authenticated;
grant all on public.user_limits to service_role;

-- Users may read their own override; only admin RPCs (security definer) write.
drop policy if exists "Users can read own user_limits" on public.user_limits;
create policy "Users can read own user_limits"
  on public.user_limits for select
  to authenticated
  using (user_id = auth.uid() or public.is_admin());

-- ── Effective limits ──
create or replace function public.effective_user_limits(p_user_id uuid)
returns table (max_trading_accounts int, max_backtests int)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(ul.max_trading_accounts, al.max_trading_accounts, 2),
    coalesce(ul.max_backtests, al.max_backtests, 12)
  from (select 1) as one
  left join public.app_limits al on al.id = 1
  left join public.user_limits ul on ul.user_id = p_user_id;
$$;

revoke all on function public.effective_user_limits(uuid) from public, anon, authenticated;

create or replace function public.get_my_limits()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  eff record;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;
  select * into eff from public.effective_user_limits(auth.uid());
  return jsonb_build_object(
    'max_trading_accounts', eff.max_trading_accounts,
    'max_backtests', eff.max_backtests
  );
end;
$$;

grant execute on function public.get_my_limits() to authenticated;
revoke all on function public.get_my_limits() from public, anon;

-- ── Enforcement triggers ──
create or replace function public.enforce_trading_account_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_accounts int;
  current_count int;
begin
  select max_trading_accounts into max_accounts
  from public.effective_user_limits(new.user_id);

  select count(*)::int into current_count
  from public.trading_accounts
  where user_id = new.user_id;

  if current_count >= max_accounts then
    raise exception 'Account limit reached: you can create at most % trading accounts.', max_accounts
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_trading_account_limit on public.trading_accounts;
create trigger trg_enforce_trading_account_limit
  before insert on public.trading_accounts
  for each row
  execute function public.enforce_trading_account_limit();

create or replace function public.enforce_backtest_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_allowed int;
  current_count int;
begin
  select l.max_backtests into max_allowed
  from public.effective_user_limits(new.user_id) l;

  select count(*)::int into current_count
  from public.strategy_backtests
  where user_id = new.user_id;

  if current_count >= max_allowed then
    raise exception 'Backtest limit reached: you can create at most % backtesting strategies.', max_allowed
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_backtest_limit on public.strategy_backtests;
create trigger trg_enforce_backtest_limit
  before insert on public.strategy_backtests
  for each row
  execute function public.enforce_backtest_limit();

revoke all on function public.enforce_trading_account_limit() from public, anon, authenticated;
revoke all on function public.enforce_backtest_limit() from public, anon, authenticated;

-- ── Admin RPCs ──
create or replace function public.admin_update_app_limits(
  p_max_trading_accounts int,
  p_max_backtests int
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.app_limits%rowtype;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if p_max_trading_accounts is null or p_max_trading_accounts < 0 or p_max_trading_accounts > 1000 then
    raise exception 'max_trading_accounts must be between 0 and 1000';
  end if;
  if p_max_backtests is null or p_max_backtests < 0 or p_max_backtests > 1000 then
    raise exception 'max_backtests must be between 0 and 1000';
  end if;

  insert into public.app_limits as a (id, max_trading_accounts, max_backtests, updated_at, updated_by)
  values (1, p_max_trading_accounts, p_max_backtests, now(), auth.uid())
  on conflict (id) do update set
    max_trading_accounts = excluded.max_trading_accounts,
    max_backtests = excluded.max_backtests,
    updated_at = now(),
    updated_by = auth.uid()
  returning * into row;

  return jsonb_build_object(
    'max_trading_accounts', row.max_trading_accounts,
    'max_backtests', row.max_backtests,
    'updated_at', row.updated_at
  );
end;
$$;

grant execute on function public.admin_update_app_limits(int, int) to authenticated;
revoke all on function public.admin_update_app_limits(int, int) from public, anon;

-- Pass null for a field to fall back to the platform default.
create or replace function public.admin_set_user_limits(
  target_user_id uuid,
  p_max_trading_accounts int,
  p_max_backtests int
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if not exists (select 1 from public.profiles where id = target_user_id) then
    raise exception 'User not found';
  end if;
  if p_max_trading_accounts is not null and (p_max_trading_accounts < 0 or p_max_trading_accounts > 1000) then
    raise exception 'max_trading_accounts must be between 0 and 1000';
  end if;
  if p_max_backtests is not null and (p_max_backtests < 0 or p_max_backtests > 1000) then
    raise exception 'max_backtests must be between 0 and 1000';
  end if;

  if p_max_trading_accounts is null and p_max_backtests is null then
    delete from public.user_limits where user_id = target_user_id;
    return;
  end if;

  insert into public.user_limits as u (user_id, max_trading_accounts, max_backtests, updated_at, updated_by)
  values (target_user_id, p_max_trading_accounts, p_max_backtests, now(), auth.uid())
  on conflict (user_id) do update set
    max_trading_accounts = excluded.max_trading_accounts,
    max_backtests = excluded.max_backtests,
    updated_at = now(),
    updated_by = auth.uid();
end;
$$;

grant execute on function public.admin_set_user_limits(uuid, int, int) to authenticated;
revoke all on function public.admin_set_user_limits(uuid, int, int) from public, anon;

-- User list now carries backtest count + limit overrides (return type changed → drop first).
drop function if exists public.admin_list_users();
create function public.admin_list_users()
returns table (
  id uuid,
  email text,
  display_name text,
  role text,
  created_at timestamptz,
  account_count bigint,
  sync_key_count bigint,
  backtest_count bigint,
  max_trading_accounts_override int,
  max_backtests_override int
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
    (select count(*)::bigint from sync_keys sk where sk.user_id = p.id) as sync_key_count,
    (select count(*)::bigint from strategy_backtests sb where sb.user_id = p.id) as backtest_count,
    ul.max_trading_accounts as max_trading_accounts_override,
    ul.max_backtests as max_backtests_override
  from profiles p
  left join user_limits ul on ul.user_id = p.id
  order by p.created_at desc;
end;
$$;

grant execute on function public.admin_list_users() to authenticated;
revoke all on function public.admin_list_users() from public, anon;
