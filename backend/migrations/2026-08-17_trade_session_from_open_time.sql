-- Auto-fill trades.session (asian / london / ny) from open_time (UTC).
-- Asian 21:00-07:00, London 07:00-12:00, New York 12:00-21:00.

create or replace function public.trading_session_from_time(p_ts timestamptz)
returns text
language sql
immutable
as $$
  select case
    when p_ts is null then null
    when extract(hour from timezone('utc', p_ts)) >= 7
     and extract(hour from timezone('utc', p_ts)) < 12 then 'london'
    when extract(hour from timezone('utc', p_ts)) >= 12
     and extract(hour from timezone('utc', p_ts)) < 21 then 'ny'
    else 'asian'
  end;
$$;

create or replace function public.trg_trades_fill_session()
returns trigger
language plpgsql
as $$
begin
  if NEW.session is null or btrim(NEW.session) = '' then
    NEW.session := public.trading_session_from_time(coalesce(NEW.open_time, NEW.close_time));
  end if;
  return NEW;
end;
$$;

drop trigger if exists trades_fill_session on public.trades;
create trigger trades_fill_session
  before insert or update of open_time, close_time, session
  on public.trades
  for each row
  execute function public.trg_trades_fill_session();

update public.trades
set session = public.trading_session_from_time(coalesce(open_time, close_time))
where (session is null or btrim(session) = '')
  and coalesce(open_time, close_time) is not null;
