-- ============================================================
-- FinhubKH Journal — Trading Accounts (Portfolio mode)
-- Run in Supabase SQL Editor after schema.sql + schema_mt_sync.sql
-- ============================================================

alter table trades add column if not exists account text;
alter table trades add column if not exists account_id uuid;

create table if not exists trading_accounts (
  id               uuid default gen_random_uuid() primary key,
  user_id          uuid references auth.users on delete cascade not null,
  name             text not null,
  slug             text not null,
  account_type     text not null default 'live' check (account_type in ('live', 'demo', 'prop')),
  broker           text,
  starting_balance numeric(12,2),
  color            text,
  is_default       boolean not null default false,
  created_at       timestamptz default now(),
  unique (user_id, slug)
);

alter table trades
  drop constraint if exists trades_account_id_fkey;

alter table trades
  add constraint trades_account_id_fkey
  foreign key (account_id) references trading_accounts(id) on delete cascade;

create index if not exists trades_account_id_idx on trades(account_id);
create index if not exists trading_accounts_user_id_idx on trading_accounts(user_id);

alter table trading_accounts enable row level security;

create policy "Users can view own trading accounts"
  on trading_accounts for select using (auth.uid() = user_id);

create policy "Users can insert own trading accounts"
  on trading_accounts for insert with check (auth.uid() = user_id);

create policy "Users can update own trading accounts"
  on trading_accounts for update using (auth.uid() = user_id);

create policy "Users can delete own trading accounts"
  on trading_accounts for delete using (auth.uid() = user_id);
