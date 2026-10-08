-- Limit each user to 12 strategy backtests.
-- Run in Supabase SQL Editor or: supabase db query --linked -f backend/migrations/2026-10-08_backtest_limit.sql

create or replace function public.enforce_backtest_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_backtests constant int := 12;
  current_count int;
begin
  select count(*)::int into current_count
  from public.strategy_backtests
  where user_id = new.user_id;

  if current_count >= max_backtests then
    raise exception 'Backtest limit reached: you can create at most % backtesting strategies.', max_backtests
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
