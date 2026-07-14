-- ============================================================
-- FinhubKH Journal — Compounding growth plans
-- Run in Supabase SQL Editor after trading_accounts schema
-- ============================================================

create table if not exists compounding_accounts (
  id                     uuid default gen_random_uuid() primary key,
  user_id                uuid references auth.users on delete cascade not null,
  name                   text not null,
  starting_balance       numeric(14, 2) not null check (starting_balance > 0),
  target_balance         numeric(14, 2) not null check (target_balance > 0),
  target_profit_percent  numeric(8, 4) not null check (target_profit_percent > 0 and target_profit_percent <= 100),
  risk_percent           numeric(8, 4) not null default 2 check (risk_percent > 0 and risk_percent <= 100),
  risk_reward_ratio      numeric(8, 4) default 3,
  stop_loss_pips         numeric(10, 2),
  stop_loss_points       numeric(10, 2),
  lot_size_method        text not null default 'fixed_risk_pips'
                           check (lot_size_method in ('fixed_risk_pips', 'fixed_risk_points', 'percent_of_balance')),
  pip_value_per_lot      numeric(12, 4) not null default 10,
  point_value_per_lot    numeric(12, 4) not null default 1,
  pl_source              text not null default 'calculated'
                           check (pl_source in ('calculated', 'calendar')),
  trading_account_id     uuid references public.trading_accounts(id) on delete set null,
  created_at             timestamptz default now() not null,
  updated_at             timestamptz default now() not null,
  check (target_balance > starting_balance)
);

create index if not exists compounding_accounts_user_id_idx
  on compounding_accounts(user_id);

create index if not exists compounding_accounts_user_created_idx
  on compounding_accounts(user_id, created_at desc);

create index if not exists compounding_accounts_trading_account_id_idx
  on compounding_accounts(trading_account_id);

alter table compounding_accounts enable row level security;

drop policy if exists "Users can view own compounding accounts" on compounding_accounts;
create policy "Users can view own compounding accounts"
  on compounding_accounts for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own compounding accounts" on compounding_accounts;
create policy "Users can insert own compounding accounts"
  on compounding_accounts for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own compounding accounts" on compounding_accounts;
create policy "Users can update own compounding accounts"
  on compounding_accounts for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own compounding accounts" on compounding_accounts;
create policy "Users can delete own compounding accounts"
  on compounding_accounts for delete using (auth.uid() = user_id);

create table if not exists compounding_trades (
  id                       uuid default gen_random_uuid() primary key,
  user_id                  uuid references auth.users on delete cascade not null,
  compounding_account_id   uuid references public.compounding_accounts(id) on delete cascade not null,
  trade_number             integer not null check (trade_number > 0),
  date                     date not null,
  result                   text not null check (result in ('win', 'loss', 'breakeven')),
  actual_pl                numeric(14, 2),
  use_manual_pl            boolean not null default false,
  notes                    text not null default '',
  calendar_trades          integer,
  calendar_win_trades      integer,
  calendar_loss_trades     integer,
  created_at               timestamptz default now() not null,
  updated_at               timestamptz default now() not null
);

create index if not exists compounding_trades_account_idx
  on compounding_trades(compounding_account_id);

create index if not exists compounding_trades_user_account_idx
  on compounding_trades(user_id, compounding_account_id);

create index if not exists compounding_trades_account_number_idx
  on compounding_trades(compounding_account_id, trade_number);

alter table compounding_trades enable row level security;

drop policy if exists "Users can view own compounding trades" on compounding_trades;
create policy "Users can view own compounding trades"
  on compounding_trades for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own compounding trades" on compounding_trades;
create policy "Users can insert own compounding trades"
  on compounding_trades for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.compounding_accounts a
      where a.id = compounding_account_id and a.user_id = auth.uid()
    )
  );

drop policy if exists "Users can update own compounding trades" on compounding_trades;
create policy "Users can update own compounding trades"
  on compounding_trades for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own compounding trades" on compounding_trades;
create policy "Users can delete own compounding trades"
  on compounding_trades for delete using (auth.uid() = user_id);
