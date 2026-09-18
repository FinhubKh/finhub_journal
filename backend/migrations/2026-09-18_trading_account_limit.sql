-- Limit each user to 2 trading accounts.
-- Run in Supabase SQL Editor.

create or replace function public.enforce_trading_account_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_accounts constant int := 2;
  current_count int;
begin
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
