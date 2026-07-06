-- Manual daily PnL overrides (calendar)
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

alter table daily_pnl enable row level security;

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
