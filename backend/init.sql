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
create policy "Admins can view all trades" on trades for select using (public.is_admin());
drop policy if exists "Admins can delete all trades" on trades;
create policy "Admins can delete all trades" on trades for delete using (public.is_admin());
drop policy if exists "Admins can view all trading accounts" on trading_accounts;
create policy "Admins can view all trading accounts" on trading_accounts for select using (public.is_admin());
drop policy if exists "Admins can delete all trading accounts" on trading_accounts;
create policy "Admins can delete all trading accounts" on trading_accounts for delete using (public.is_admin());
drop policy if exists "Admins can view all sync keys" on sync_keys;
create policy "Admins can view all sync keys" on sync_keys for select using (public.is_admin());
drop policy if exists "Admins can delete all sync keys" on sync_keys;
create policy "Admins can delete all sync keys" on sync_keys for delete using (public.is_admin());
drop policy if exists "Admins can view all daily pnl" on daily_pnl;
create policy "Admins can view all daily pnl" on daily_pnl for select using (public.is_admin());
drop policy if exists "Admins can delete all daily pnl" on daily_pnl;
create policy "Admins can delete all daily pnl" on daily_pnl for delete using (public.is_admin());
drop policy if exists "Admins can view all checklist steps" on checklist_steps;
create policy "Admins can view all checklist steps" on checklist_steps for select using (public.is_admin());
drop policy if exists "Admins can view all entry models" on entry_models;
create policy "Admins can view all entry models" on entry_models for select using (public.is_admin());

create or replace function public.admin_platform_stats()
returns json language plpgsql security definer set search_path = public as $$
declare result json;
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
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
end; $$;

create or replace function public.admin_list_users()
returns table (
  id uuid, email text, display_name text, role text, created_at timestamptz,
  trade_count bigint, account_count bigint, sync_key_count bigint, total_pnl numeric, last_trade_date date
) language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Forbidden'; end if;
  return query
  select p.id, p.email, p.display_name, p.role, p.created_at,
    (select count(*)::bigint from trades t where t.user_id = p.id),
    (select count(*)::bigint from trading_accounts ta where ta.user_id = p.id),
    (select count(*)::bigint from sync_keys sk where sk.user_id = p.id),
    coalesce((select sum(t.pnl_usd) from trades t where t.user_id = p.id), 0),
    (select max(t.date) from trades t where t.user_id = p.id)
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

-- ── LEADERBOARD ─────────────────────────────────────────────
create or replace function get_leaderboard()
returns table (
  user_id      uuid,
  email        text,
  display_name text,
  total_trades bigint,
  win_rate     numeric,
  total_pnl    numeric
)
language sql
security definer
set search_path = public
as $$
  select
    t.user_id,
    au.email::text,
    au.raw_user_meta_data->>'display_name' as display_name,
    count(*)::bigint as total_trades,
    round(
      sum(case when t.result = 'win' then 1 else 0 end)::numeric
      / nullif(count(*), 0) * 100,
    1) as win_rate,
    sum(t.pnl_usd) as total_pnl
  from trades t
  join auth.users au on au.id = t.user_id
  group by t.user_id, au.email, au.raw_user_meta_data
  having count(*) >= 1
  order by win_rate desc;
$$;

grant execute on function get_leaderboard() to authenticated;
