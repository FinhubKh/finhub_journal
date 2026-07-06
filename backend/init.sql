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
  metaapi_account_id  text,
  metaapi_server      text,
  mt_login            text,
  metaapi_platform    text check (metaapi_platform in ('mt4', 'mt5')),
  metaapi_region      text,
  connection_status   text default 'disconnected',
  last_synced_at      timestamptz,
  sync_error          text,
  created_at          timestamptz default now(),
  unique (user_id, slug)
);

alter table trades
  drop constraint if exists trades_account_id_fkey;

alter table trades
  add constraint trades_account_id_fkey
  foreign key (account_id) references trading_accounts(id) on delete set null;

create index if not exists trading_accounts_user_id_idx on trading_accounts(user_id);

-- ── EA SYNC KEYS ────────────────────────────────────────────
create table if not exists sync_keys (
  id         uuid default gen_random_uuid() primary key,
  user_id    uuid references auth.users on delete cascade not null unique,
  key_hash   text not null,
  raw_key    text,
  created_at timestamptz default now()
);

-- ── ROW LEVEL SECURITY ────────────────────────────────────────
alter table trades            enable row level security;
alter table checklist_steps   enable row level security;
alter table entry_models      enable row level security;
alter table trading_accounts  enable row level security;
alter table sync_keys         enable row level security;

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
