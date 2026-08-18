-- Strategy Tester HTML backtests. Separate from live journal daily_pnl.

create table if not exists public.strategy_backtests (
  id             uuid default gen_random_uuid() primary key,
  user_id        uuid not null references auth.users on delete cascade,
  name           text not null,
  source_html    text,
  currency       text not null default 'usd' check (currency in ('usd', 'cent')),
  report_symbol  text,
  range_from     date,
  range_to       date,
  total_pnl      numeric(14,2) not null default 0,
  trade_count    integer not null default 0,
  wins           integer not null default 0,
  losses         integer not null default 0,
  be_count       integer not null default 0,
  profit_factor  numeric(10,2),
  created_at     timestamptz not null default now()
);

create index if not exists strategy_backtests_user_created_idx
  on public.strategy_backtests (user_id, created_at desc);

create table if not exists public.strategy_backtest_daily (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users on delete cascade,
  backtest_id  uuid not null references public.strategy_backtests(id) on delete cascade,
  date         date not null,
  pnl_usd      numeric(14,2) not null default 0,
  trade_count  integer not null default 0,
  wins         integer not null default 0,
  losses       integer not null default 0,
  be_count     integer not null default 0,
  unique (backtest_id, date)
);

create index if not exists strategy_backtest_daily_user_date_idx
  on public.strategy_backtest_daily (user_id, date);

create index if not exists strategy_backtest_daily_backtest_idx
  on public.strategy_backtest_daily (backtest_id, date);

alter table public.strategy_backtests enable row level security;
alter table public.strategy_backtest_daily enable row level security;

drop policy if exists "Users can view own strategy backtests" on public.strategy_backtests;
create policy "Users can view own strategy backtests"
  on public.strategy_backtests for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own strategy backtests" on public.strategy_backtests;
create policy "Users can insert own strategy backtests"
  on public.strategy_backtests for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own strategy backtests" on public.strategy_backtests;
create policy "Users can update own strategy backtests"
  on public.strategy_backtests for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own strategy backtests" on public.strategy_backtests;
create policy "Users can delete own strategy backtests"
  on public.strategy_backtests for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own strategy backtest daily" on public.strategy_backtest_daily;
create policy "Users can view own strategy backtest daily"
  on public.strategy_backtest_daily for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own strategy backtest daily" on public.strategy_backtest_daily;
create policy "Users can insert own strategy backtest daily"
  on public.strategy_backtest_daily for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own strategy backtest daily" on public.strategy_backtest_daily;
create policy "Users can update own strategy backtest daily"
  on public.strategy_backtest_daily for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own strategy backtest daily" on public.strategy_backtest_daily;
create policy "Users can delete own strategy backtest daily"
  on public.strategy_backtest_daily for delete using (auth.uid() = user_id);

grant select, insert, update, delete on public.strategy_backtests to authenticated;
grant select, insert, update, delete on public.strategy_backtest_daily to authenticated;
