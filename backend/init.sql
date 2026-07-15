-- ============================================================
-- FinhubKH Journal — Full database init (fresh Supabase project)
-- Run this entire file once in: Supabase Dashboard → SQL → New query
-- ============================================================

-- ── TRADES ──────────────────────────────────────────────────
create table if not exists trades (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  created_at  timestamptz default now(),
  date        date not null,
  result      text not null check (result in ('win', 'loss', 'be')),
  r_value     numeric(5,2) default 0,
  pnl_usd     numeric(10,2) default 0,
  notes       text,
  model       text,
  session     text check (session in ('asian', 'london', 'ny')),
  account     text,
  account_id  uuid,
  source      text default 'manual' check (source in ('manual', 'api', 'metaapi')),
  ticket      bigint,
  symbol      text,
  direction   text check (direction in ('buy', 'sell')),
  entry_price numeric(14,5),
  exit_price  numeric(14,5),
  lot_size    numeric(10,2),
  open_time   timestamptz,
  close_time  timestamptz
);

alter table trades drop constraint if exists trades_user_id_ticket_key;
drop index if exists trades_user_ticket_unique;
alter table trades add constraint trades_user_id_ticket_key unique (user_id, ticket);

create index if not exists trades_account_id_idx on trades(account_id);
create index if not exists trades_user_date_idx on trades(user_id, date desc);

-- ── CHECKLIST STEPS ─────────────────────────────────────────
create table if not exists checklist_steps (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  position   integer not null default 0,
  section    text not null,
  title      text not null,
  created_at timestamptz default now()
);

-- ── ENTRY MODELS ────────────────────────────────────────────
create table if not exists entry_models (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null,
  name       text not null,
  created_at timestamptz default now()
);

-- ── TRADING ACCOUNTS (portfolio mode) ───────────────────────
create table if not exists trading_accounts (
  id                  uuid default gen_random_uuid() primary key,
  user_id             uuid references auth.users on delete cascade not null,
  name                text not null,
  slug                text not null,
  account_type        text not null default 'live' check (account_type in ('live', 'demo', 'prop')),
  broker              text,
  starting_balance    numeric(12,2),
  color               text,
  is_default          boolean not null default false,
  connection_status   text default 'manual',
  pnl_denomination    text not null default 'usd' check (pnl_denomination in ('usd', 'cent')),
  is_public           boolean not null default false,
  share_token         text,
  published_at        timestamptz,
  created_at          timestamptz default now(),
  unique (user_id, slug)
);

alter table trades
  drop constraint if exists trades_account_id_fkey;

alter table trades
  add constraint trades_account_id_fkey
  foreign key (account_id) references trading_accounts(id) on delete cascade;

create index if not exists trading_accounts_user_id_idx on trading_accounts(user_id);

-- ── EA SYNC KEYS (one per trading account) ───────────────────
create table if not exists sync_keys (
  id                  uuid default gen_random_uuid() primary key,
  user_id             uuid references auth.users on delete cascade not null,
  trading_account_id  uuid references trading_accounts(id) on delete cascade not null unique,
  key_hash            text not null unique,
  raw_key             text,
  created_at          timestamptz default now()
);

-- ── DAILY PNL (manual calendar overrides) ─────────────────────
create table if not exists daily_pnl (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  date        date not null,
  pnl_usd     numeric(10,2) not null default 0,
  trade_count integer,
  notes       text,
  created_at  timestamptz default now(),
  unique (user_id, date)
);

alter table daily_pnl add column if not exists trade_count integer;

create index if not exists daily_pnl_user_date_idx on daily_pnl(user_id, date);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table trades            enable row level security;
alter table checklist_steps   enable row level security;
alter table entry_models      enable row level security;
alter table trading_accounts  enable row level security;
alter table sync_keys         enable row level security;
alter table daily_pnl         enable row level security;

-- Trades
drop policy if exists "Users can view own trades" on trades;
create policy "Users can view own trades"
  on trades for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own trades" on trades;
create policy "Users can insert own trades"
  on trades for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own trades" on trades;
create policy "Users can update own trades"
  on trades for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own trades" on trades;
create policy "Users can delete own trades"
  on trades for delete using (auth.uid() = user_id);

-- Checklist steps
drop policy if exists "Users can view own steps" on checklist_steps;
create policy "Users can view own steps"
  on checklist_steps for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own steps" on checklist_steps;
create policy "Users can insert own steps"
  on checklist_steps for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own steps" on checklist_steps;
create policy "Users can update own steps"
  on checklist_steps for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own steps" on checklist_steps;
create policy "Users can delete own steps"
  on checklist_steps for delete using (auth.uid() = user_id);

-- Entry models
drop policy if exists "Users can view own models" on entry_models;
create policy "Users can view own models"
  on entry_models for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own models" on entry_models;
create policy "Users can insert own models"
  on entry_models for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own models" on entry_models;
create policy "Users can update own models"
  on entry_models for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own models" on entry_models;
create policy "Users can delete own models"
  on entry_models for delete using (auth.uid() = user_id);

-- Trading accounts
drop policy if exists "Users can view own trading accounts" on trading_accounts;
create policy "Users can view own trading accounts"
  on trading_accounts for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own trading accounts" on trading_accounts;
create policy "Users can insert own trading accounts"
  on trading_accounts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own trading accounts" on trading_accounts;
create policy "Users can update own trading accounts"
  on trading_accounts for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own trading accounts" on trading_accounts;
create policy "Users can delete own trading accounts"
  on trading_accounts for delete using (auth.uid() = user_id);

-- Sync keys
drop policy if exists "Users manage own sync key" on sync_keys;
create policy "Users manage own sync key"
  on sync_keys for all using (auth.uid() = user_id);

-- Daily PnL
drop policy if exists "Users can view own daily pnl" on daily_pnl;
create policy "Users can view own daily pnl"
  on daily_pnl for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own daily pnl" on daily_pnl;
create policy "Users can insert own daily pnl"
  on daily_pnl for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own daily pnl" on daily_pnl;
create policy "Users can update own daily pnl"
  on daily_pnl for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own daily pnl" on daily_pnl;
create policy "Users can delete own daily pnl"
  on daily_pnl for delete using (auth.uid() = user_id);

-- ── PROFILES + ADMIN ────────────────────────────────────────
-- Full definitions also in backend/schema_profiles_admin.sql

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
returns boolean language sql stable security definer set search_path = public
as $$ select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin'); $$;
grant execute on function public.is_admin() to authenticated;
revoke all on function public.is_admin() from public;
revoke all on function public.is_admin() from anon;

drop policy if exists "Users can view own profile" on profiles;
create policy "Users can view own profile" on profiles for select using (auth.uid() = id);
drop policy if exists "Admins can view all profiles" on profiles;
create policy "Admins can view all profiles" on profiles for select using (public.is_admin());
drop policy if exists "Users can update own profile display name" on profiles;
create policy "Users can update own profile display name" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "Admins can update all profiles" on profiles;
create policy "Admins can update all profiles" on profiles for update using (public.is_admin());
drop policy if exists "Admins can delete profiles" on profiles;
create policy "Admins can delete profiles" on profiles for delete using (public.is_admin());

create or replace function public.prevent_profile_role_escalation()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.role is distinct from old.role then
    raise exception 'Cannot change role';
  end if;
  return new;
end; $$;
drop trigger if exists profiles_role_guard on profiles;
create trigger profiles_role_guard before update on profiles for each row execute function public.prevent_profile_role_escalation();

insert into public.profiles (id, email, display_name, role)
select u.id, u.email, coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)), 'user'
from auth.users u on conflict (id) do update set email = excluded.email;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, display_name, role)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)), 'user')
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

drop policy if exists "Admins can view all trades" on trades;
drop policy if exists "Admins can delete all trades" on trades;
drop policy if exists "Admins can view all trading accounts" on trading_accounts;
create policy "Admins can view all trading accounts" on trading_accounts for select using (public.is_admin());
drop policy if exists "Admins can delete all trading accounts" on trading_accounts;
create policy "Admins can delete all trading accounts" on trading_accounts for delete using (public.is_admin());
drop policy if exists "Admins can view all sync keys" on sync_keys;
create policy "Admins can view all sync keys" on sync_keys for select using (public.is_admin());
drop policy if exists "Admins can delete all sync keys" on sync_keys;
create policy "Admins can delete all sync keys" on sync_keys for delete using (public.is_admin());

create or replace function public.admin_platform_stats()
returns json language plpgsql security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  select json_build_object(
    'total_users', (select count(*)::int from profiles),
    'admin_users', (select count(*)::int from profiles where role = 'admin'),
    'total_accounts', (select count(*)::int from trading_accounts),
    'active_sync_keys', (select count(*)::int from sync_keys)
  ) into result;
  return result;
end; $$;

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, display_name text, role text, created_at timestamptz,
  account_count bigint, sync_key_count bigint
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return query
  select p.id, p.email, p.display_name, p.role, p.created_at,
    (select count(*)::bigint from trading_accounts ta where ta.user_id = p.id),
    (select count(*)::bigint from sync_keys sk where sk.user_id = p.id)
  from profiles p order by p.created_at desc;
end; $$;

create or replace function public.admin_set_user_role(target_user_id uuid, new_role text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if new_role not in ('user', 'admin') then raise exception 'Invalid role'; end if;
  if target_user_id = auth.uid() and new_role <> 'admin' then raise exception 'Cannot demote yourself'; end if;
  update profiles set role = new_role where id = target_user_id;
  if not found then raise exception 'User not found'; end if;
end; $$;

create or replace function public.admin_delete_user(target_user_id uuid)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  if target_user_id = auth.uid() then raise exception 'Cannot delete yourself'; end if;
  delete from auth.users where id = target_user_id;
end; $$;

grant execute on function public.admin_platform_stats() to authenticated;
grant execute on function public.admin_list_users() to authenticated;
grant execute on function public.admin_set_user_role(uuid, text) to authenticated;
grant execute on function public.admin_delete_user(uuid) to authenticated;
revoke all on function public.admin_platform_stats() from public, anon;
revoke all on function public.admin_list_users() from public, anon;
revoke all on function public.admin_set_user_role(uuid, text) from public, anon;
revoke all on function public.admin_delete_user(uuid) from public, anon;

-- Trigger helpers must not be callable as RPC
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.prevent_profile_role_escalation() from public, anon, authenticated;

-- ── LEADERBOARD (published accounts) — full defs in schema_leaderboard.sql ─
-- Removed legacy all-users get_leaderboard that exposed emails.
-- Run backend/schema_leaderboard.sql in Supabase if leaderboard RPC is missing.

drop function if exists public.get_leaderboard();

-- ============================================================
-- FinhubKH Journal — Publish trading accounts (public share links)
-- Run in Supabase SQL Editor
-- ============================================================

alter table trading_accounts
  add column if not exists is_public boolean not null default false;

alter table trading_accounts
  add column if not exists share_token text;

alter table trading_accounts
  add column if not exists published_at timestamptz;

create unique index if not exists trading_accounts_share_token_uidx
  on trading_accounts(share_token)
  where share_token is not null;

create index if not exists trading_accounts_is_public_idx
  on trading_accounts(is_public)
  where is_public = true;

-- Public can read published account rows (owners still use their own policy)
drop policy if exists "Anyone can view published trading accounts" on trading_accounts;
create policy "Anyone can view published trading accounts"
  on trading_accounts for select
  using (is_public = true and share_token is not null);

-- Public can read trades that belong to a published account
drop policy if exists "Anyone can view trades of published accounts" on trades;
create policy "Anyone can view trades of published accounts"
  on trades for select
  using (
    exists (
      select 1
      from public.trading_accounts a
      where a.id = trades.account_id
        and a.is_public = true
        and a.share_token is not null
    )
  );

-- Owner: publish / unpublish (generates a stable share_token on first publish)
create or replace function public.set_trading_account_public(
  p_account_id uuid,
  p_is_public boolean
)
returns public.trading_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.trading_accounts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.trading_accounts a
  set
    is_public = p_is_public,
    share_token = case
      when p_is_public and a.share_token is null then replace(gen_random_uuid()::text, '-', '')
      else a.share_token
    end,
    published_at = case
      when p_is_public then coalesce(a.published_at, now())
      else a.published_at
    end
  where a.id = p_account_id
    and a.user_id = auth.uid()
  returning * into row_out;

  if row_out.id is null then
    raise exception 'Account not found';
  end if;

  return row_out;
end;
$$;

revoke all on function public.set_trading_account_public(uuid, boolean) from public, anon;
grant execute on function public.set_trading_account_public(uuid, boolean) to authenticated;

-- Public bundle: account + owner display name + trades (no sync keys / email)
create or replace function public.get_published_trading_account(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  acc public.trading_accounts;
  owner_name text;
  trade_rows jsonb;
begin
  if p_token is null or length(trim(p_token)) < 8 then
    return null;
  end if;

  select * into acc
  from public.trading_accounts
  where share_token = trim(p_token)
    and is_public = true
  limit 1;

  if acc.id is null then
    return null;
  end if;

  select coalesce(nullif(trim(p.display_name), ''), split_part(coalesce(p.email, ''), '@', 1), 'Trader')
  into owner_name
  from public.profiles p
  where p.id = acc.user_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'date', t.date,
        'symbol', t.symbol,
        'direction', t.direction,
        'result', t.result,
        'pnl_usd', t.pnl_usd,
        'r_value', t.r_value,
        'session', t.session,
        'model', t.model,
        'notes', t.notes,
        'account_id', t.account_id,
        'created_at', t.created_at
      )
      order by t.date desc, t.created_at desc
    ),
    '[]'::jsonb
  )
  into trade_rows
  from public.trades t
  where t.account_id = acc.id;

  return jsonb_build_object(
    'account', jsonb_build_object(
      'id', acc.id,
      'name', acc.name,
      'slug', acc.slug,
      'account_type', acc.account_type,
      'broker', acc.broker,
      'color', acc.color,
      'pnl_denomination', acc.pnl_denomination,
      'starting_balance', acc.starting_balance,
      'share_token', acc.share_token,
      'published_at', acc.published_at,
      'created_at', acc.created_at
    ),
    'owner', jsonb_build_object(
      'display_name', coalesce(owner_name, 'Trader')
    ),
    'trades', trade_rows
  );
end;
$$;

revoke all on function public.get_published_trading_account(text) from public;
grant execute on function public.get_published_trading_account(text) to anon, authenticated;

-- ============================================================
-- Public leaderboard (published accounts) — also in schema_leaderboard.sql
-- ============================================================

create or replace function public.get_public_leaderboard(
  p_limit int default 50,
  p_min_trades int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lim int := greatest(1, least(coalesce(p_limit, 50), 100));
  min_trades int := greatest(0, least(coalesce(p_min_trades, 5), 1000));
  rows jsonb;
begin
  select coalesce(
    jsonb_agg(row_to_json(ranked)::jsonb order by ranked.rank_pnl),
    '[]'::jsonb
  )
  into rows
  from (
    select
      row_number() over (order by s.total_pnl desc nulls last, s.trade_count desc) as rank_pnl,
      s.account_id,
      s.account_name,
      s.share_token,
      s.account_type,
      s.pnl_denomination,
      s.color,
      s.published_at,
      s.display_name,
      s.trade_count,
      s.wins,
      s.losses,
      round(s.total_pnl::numeric, 2) as total_pnl,
      case
        when s.trade_count > 0 then round((s.wins::numeric / s.trade_count::numeric) * 100)
        else 0
      end as win_rate,
      case
        when s.gross_loss > 0 then round((s.gross_win / s.gross_loss)::numeric, 2)
        when s.gross_win > 0 then null
        else null
      end as profit_factor,
      case
        when s.gross_loss = 0 and s.gross_win > 0 then true
        else false
      end as profit_factor_infinite
    from (
      select
        a.id as account_id,
        a.name as account_name,
        a.share_token,
        a.account_type,
        a.pnl_denomination,
        a.color,
        a.published_at,
        coalesce(
          nullif(trim(p.display_name), ''),
          split_part(coalesce(p.email, ''), '@', 1),
          'Trader'
        ) as display_name,
        count(t.id)::int as trade_count,
        count(*) filter (where t.result = 'win')::int as wins,
        count(*) filter (where t.result = 'loss')::int as losses,
        coalesce(sum(t.pnl_usd), 0)::float8 as total_pnl,
        coalesce(sum(t.pnl_usd) filter (where t.result = 'win'), 0)::float8 as gross_win,
        abs(coalesce(sum(t.pnl_usd) filter (where t.result = 'loss'), 0))::float8 as gross_loss
      from public.trading_accounts a
      left join public.profiles p on p.id = a.user_id
      left join public.trades t on t.account_id = a.id
      where a.is_public = true
        and a.share_token is not null
      group by
        a.id, a.name, a.share_token, a.account_type, a.pnl_denomination,
        a.color, a.published_at, p.display_name, p.email
      having count(t.id) >= min_trades
    ) s
    order by s.total_pnl desc nulls last, s.trade_count desc
    limit lim
  ) ranked;

  return jsonb_build_object(
    'entries', rows,
    'min_trades', min_trades,
    'limit', lim
  );
end;
$$;

revoke all on function public.get_public_leaderboard(int, int) from public;
grant execute on function public.get_public_leaderboard(int, int) to anon, authenticated;

create or replace function public.get_leaderboard()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select public.get_public_leaderboard(50, 5);
$$;

revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;

