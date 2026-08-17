-- Extend cached account stats (streaks / R / drawdown) + daily rollup.
-- Keeps journal bundle + public share off full trade scans for overview metrics.

alter table public.account_trade_stats
  add column if not exists total_r double precision not null default 0;
alter table public.account_trade_stats
  add column if not exists best_streak int not null default 0;
alter table public.account_trade_stats
  add column if not exists worst_streak int not null default 0;
alter table public.account_trade_stats
  add column if not exists max_dd double precision not null default 0;

create table if not exists public.account_daily_stats (
  account_id uuid not null references public.trading_accounts(id) on delete cascade,
  date date not null,
  pnl double precision not null default 0,
  r_value double precision not null default 0,
  trades int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  primary key (account_id, date)
);

create index if not exists account_daily_stats_date_idx
  on public.account_daily_stats (date);

alter table public.account_daily_stats enable row level security;

drop policy if exists "Users can view own account daily stats" on public.account_daily_stats;
create policy "Users can view own account daily stats"
  on public.account_daily_stats for select
  using (
    exists (
      select 1 from public.trading_accounts a
      where a.id = account_daily_stats.account_id
        and a.user_id = auth.uid()
    )
  );

create or replace function public.refresh_account_trade_stats(p_account_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_account_ids is null or array_length(p_account_ids, 1) is null then
    return;
  end if;

  delete from public.account_trade_stats s
  where s.account_id = any(p_account_ids)
    and not exists (
      select 1 from public.trading_accounts a where a.id = s.account_id
    );

  delete from public.account_daily_stats d
  where d.account_id = any(p_account_ids);

  insert into public.account_daily_stats (account_id, date, pnl, r_value, trades, wins, losses)
  select
    t.account_id,
    t.date,
    coalesce(sum(t.pnl_usd), 0)::float8,
    coalesce(sum(t.r_value), 0)::float8,
    count(*)::int,
    count(*) filter (where t.result = 'win')::int,
    count(*) filter (where t.result = 'loss')::int
  from public.trades t
  where t.account_id = any(p_account_ids)
  group by t.account_id, t.date;

  insert into public.account_trade_stats (
    account_id, user_id, trade_count, wins, losses,
    total_pnl, gross_win, gross_loss, total_r, best_streak, worst_streak, max_dd, updated_at
  )
  select
    a.id,
    a.user_id,
    coalesce(agg.trade_count, 0),
    coalesce(agg.wins, 0),
    coalesce(agg.losses, 0),
    coalesce(agg.total_pnl, 0),
    coalesce(agg.gross_win, 0),
    coalesce(agg.gross_loss, 0),
    coalesce(r.total_r, 0),
    coalesce(st.best_streak, 0),
    coalesce(st.worst_streak, 0),
    coalesce(dd.max_dd, 0),
    now()
  from public.trading_accounts a
  left join (
    select
      t.account_id,
      count(*)::int as trade_count,
      count(*) filter (where t.result = 'win')::int as wins,
      count(*) filter (where t.result = 'loss')::int as losses,
      coalesce(sum(t.pnl_usd), 0)::float8 as total_pnl,
      coalesce(sum(t.pnl_usd) filter (where t.result = 'win'), 0)::float8 as gross_win,
      abs(coalesce(sum(t.pnl_usd) filter (where t.result = 'loss'), 0))::float8 as gross_loss
    from public.trades t
    where t.account_id = any(p_account_ids)
    group by t.account_id
  ) agg on agg.account_id = a.id
  left join lateral (
    select coalesce(sum(
      case
        when abs(coalesce(t.r_value, 0)) > 0.01 then t.r_value
        when coalesce(agg.losses, 0) > 0 and coalesce(agg.gross_loss, 0) > 0
          then coalesce(t.pnl_usd, 0) / (agg.gross_loss / agg.losses)
        else 0
      end
    ), 0)::float8 as total_r
    from public.trades t
    where t.account_id = a.id
  ) r on true
  left join lateral (
    select
      coalesce(max(cnt) filter (where result = 'win'), 0)::int as best_streak,
      coalesce(max(cnt) filter (where result = 'loss'), 0)::int as worst_streak
    from (
      select result, count(*) as cnt
      from (
        select
          result,
          (row_number() over (order by date, created_at, id)
           - row_number() over (partition by result order by date, created_at, id)) as grp
        from public.trades
        where account_id = a.id
          and result in ('win', 'loss')
      ) islands
      group by result, grp
    ) g
  ) st on true
  left join lateral (
    select coalesce(max(peak - cum), 0)::float8 as max_dd
    from (
      select
        cum,
        max(cum) over (order by date, created_at, id rows unbounded preceding) as peak
      from (
        select
          date,
          created_at,
          id,
          sum(coalesce(pnl_usd, 0)) over (order by date, created_at, id rows unbounded preceding) as cum
        from public.trades
        where account_id = a.id
      ) c
    ) p
  ) dd on true
  where a.id = any(p_account_ids)
  on conflict (account_id) do update set
    user_id = excluded.user_id,
    trade_count = excluded.trade_count,
    wins = excluded.wins,
    losses = excluded.losses,
    total_pnl = excluded.total_pnl,
    gross_win = excluded.gross_win,
    gross_loss = excluded.gross_loss,
    total_r = excluded.total_r,
    best_streak = excluded.best_streak,
    worst_streak = excluded.worst_streak,
    max_dd = excluded.max_dd,
    updated_at = excluded.updated_at;
end;
$$;

-- Helper: format a stats object from aggregated numbers (account units or USD).
create or replace function public.journal_stats_json(
  p_total int,
  p_wins int,
  p_losses int,
  p_total_pnl float8,
  p_gross_win float8,
  p_gross_loss float8,
  p_total_r float8,
  p_best_streak int,
  p_worst_streak int,
  p_max_dd float8
)
returns jsonb
language sql
immutable
as $$
  select case when coalesce(p_total, 0) = 0 then null else jsonb_build_object(
    'total', p_total,
    'wins', p_wins,
    'losses', p_losses,
    'totalPnl', p_total_pnl,
    'wr', case when p_total > 0 then round((p_wins::numeric / p_total) * 100) else 0 end,
    'pf', case
      when p_gross_loss > 0 then to_char(round((p_gross_win / p_gross_loss)::numeric, 2), 'FM999999990.00')
      when p_gross_win > 0 then '∞'
      else '—'
    end,
    'avgWin', case when p_wins > 0 then p_gross_win / p_wins else 0 end,
    'avgLoss', case when p_losses > 0 then p_gross_loss / p_losses else 0 end,
    'rrRatio', case
      when p_losses > 0 and p_gross_loss > 0 and p_wins > 0
        then to_char(round(((p_gross_win / p_wins) / (p_gross_loss / p_losses))::numeric, 2), 'FM999999990.00')
      when p_wins > 0 and p_gross_win > 0 then '∞'
      else '—'
    end,
    'avgR', case when p_total > 0 then p_total_r / p_total else 0 end,
    'expectancy',
      (p_wins::numeric / nullif(p_total, 0)) * (case when p_wins > 0 then p_gross_win / p_wins else 0 end)
      - (p_losses::numeric / nullif(p_total, 0)) * (case when p_losses > 0 then p_gross_loss / p_losses else 0 end),
    'bestStreak', coalesce(p_best_streak, 0),
    'worstStreak', coalesce(p_worst_streak, 0),
    'maxDD', coalesce(p_max_dd, 0)
  ) end;
$$;

create or replace function public.get_my_journal_bundle(p_account_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
  result jsonb;
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.trading_accounts a
    where a.id = p_account_id and a.user_id = uid
  ) then
    raise exception 'Account not found';
  end if;

  with accounts_scope as (
    select
      a.id,
      a.name,
      a.color,
      a.account_type,
      a.pnl_denomination,
      coalesce(s.trade_count, 0) as trade_count,
      coalesce(s.wins, 0) as wins,
      coalesce(s.losses, 0) as losses,
      coalesce(s.total_pnl, 0)::float8 as total_pnl,
      coalesce(s.gross_win, 0)::float8 as gross_win,
      coalesce(s.gross_loss, 0)::float8 as gross_loss,
      coalesce(s.total_r, 0)::float8 as total_r,
      coalesce(s.best_streak, 0) as best_streak,
      coalesce(s.worst_streak, 0) as worst_streak,
      coalesce(s.max_dd, 0)::float8 as max_dd,
      case when a.pnl_denomination = 'cent' then 0.01 else 1.0 end as usd_factor
    from public.trading_accounts a
    left join public.account_trade_stats s on s.account_id = a.id
    where a.user_id = uid
      and (p_account_id is null or a.id = p_account_id)
  ),
  stats_agg as (
    select
      coalesce(sum(trade_count), 0)::int as total,
      coalesce(sum(wins), 0)::int as wins,
      coalesce(sum(losses), 0)::int as losses,
      coalesce(sum(
        case when p_account_id is null then total_pnl * usd_factor else total_pnl end
      ), 0)::float8 as total_pnl,
      coalesce(sum(
        case when p_account_id is null then gross_win * usd_factor else gross_win end
      ), 0)::float8 as gross_win,
      coalesce(sum(
        case when p_account_id is null then gross_loss * usd_factor else gross_loss end
      ), 0)::float8 as gross_loss,
      coalesce(sum(total_r), 0)::float8 as total_r,
      coalesce(max(best_streak), 0)::int as best_streak,
      coalesce(max(worst_streak), 0)::int as worst_streak,
      -- Account view: exact max DD. Portfolio: sum of account DDs is pessimistic; use max of accounts as a light proxy.
      case
        when p_account_id is not null then coalesce(max(max_dd), 0)::float8
        else coalesce(max(max_dd * usd_factor), 0)::float8
      end as max_dd
    from accounts_scope
  ),
  daily as (
    select
      d.date,
      sum(
        case
          when p_account_id is null and a.pnl_denomination = 'cent' then d.pnl / 100.0
          else d.pnl
        end
      )::float8 as pnl,
      sum(d.r_value)::float8 as r_value,
      sum(d.trades)::int as trades,
      sum(d.wins)::int as wins,
      sum(d.losses)::int as losses
    from public.account_daily_stats d
    join public.trading_accounts a on a.id = d.account_id
    where a.user_id = uid
      and (p_account_id is null or d.account_id = p_account_id)
    group by d.date
    order by d.date
  ),
  -- Portfolio max DD from daily equity (better than max of account DDs).
  portfolio_dd as (
    select coalesce(max(peak - cum), 0)::float8 as max_dd
    from (
      select
        cum,
        max(cum) over (order by date rows unbounded preceding) as peak
      from (
        select date, sum(pnl) over (order by date rows unbounded preceding) as cum
        from daily
      ) c
    ) p
  ),
  by_symbol as (
    select
      coalesce(nullif(trim(t.symbol), ''), 'Other') as name,
      count(*)::int as count,
      coalesce(sum(
        case
          when p_account_id is null and a.pnl_denomination = 'cent' then coalesce(t.pnl_usd, 0) / 100.0
          else coalesce(t.pnl_usd, 0)
        end
      ), 0)::float8 as pnl,
      round((count(*) filter (where t.result = 'win'))::numeric / nullif(count(*), 0) * 100) as wr
    from public.trades t
    left join public.trading_accounts a on a.id = t.account_id and a.user_id = uid
    where t.user_id = uid
      and (p_account_id is null or t.account_id = p_account_id)
    group by 1
    order by pnl desc
    limit 24
  ),
  by_session as (
    select
      coalesce(nullif(trim(t.session), ''), 'Other') as name,
      count(*)::int as count,
      coalesce(sum(
        case
          when p_account_id is null and a.pnl_denomination = 'cent' then coalesce(t.pnl_usd, 0) / 100.0
          else coalesce(t.pnl_usd, 0)
        end
      ), 0)::float8 as pnl,
      round((count(*) filter (where t.result = 'win'))::numeric / nullif(count(*), 0) * 100) as wr
    from public.trades t
    left join public.trading_accounts a on a.id = t.account_id and a.user_id = uid
    where t.user_id = uid
      and (p_account_id is null or t.account_id = p_account_id)
    group by 1
    order by pnl desc
    limit 24
  ),
  accounts as (
    select
      id as account_id,
      name,
      color,
      account_type,
      pnl_denomination,
      trade_count,
      wins,
      losses,
      total_pnl
    from accounts_scope
    where trade_count > 0
    order by total_pnl desc
  )
  select jsonb_build_object(
    'stats', public.journal_stats_json(
      s.total, s.wins, s.losses, s.total_pnl, s.gross_win, s.gross_loss, s.total_r,
      s.best_streak, s.worst_streak,
      case when p_account_id is null then pd.max_dd else s.max_dd end
    ),
    'daily', coalesce((select jsonb_agg(to_jsonb(d) order by d.date) from daily d), '[]'::jsonb),
    'breakdown', jsonb_build_object(
      'symbol', coalesce((select jsonb_agg(to_jsonb(b)) from by_symbol b), '[]'::jsonb),
      'session', coalesce((select jsonb_agg(to_jsonb(b)) from by_session b), '[]'::jsonb)
    ),
    'accounts', coalesce((select jsonb_agg(to_jsonb(a)) from accounts a), '[]'::jsonb)
  )
  into result
  from stats_agg s
  cross join portfolio_dd pd;

  return result;
end;
$$;

revoke all on function public.get_my_journal_bundle(uuid) from public, anon;
grant execute on function public.get_my_journal_bundle(uuid) to authenticated;

create or replace function public.get_published_trading_account(
  p_token text,
  p_limit int default null
)
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
  daily_rows jsonb;
  stats_row public.account_trade_stats;
  total_count int;
  lim int := greatest(1, least(coalesce(nullif(p_limit, 0), 500), 1000));
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

  select * into stats_row
  from public.account_trade_stats s
  where s.account_id = acc.id;

  total_count := coalesce(stats_row.trade_count, 0);
  if stats_row.account_id is null then
    select count(*)::int into total_count
    from public.trades t
    where t.account_id = acc.id;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'date', d.date,
        'pnl', d.pnl,
        'r_value', d.r_value,
        'trades', d.trades,
        'wins', d.wins,
        'losses', d.losses
      )
      order by d.date
    ),
    '[]'::jsonb
  )
  into daily_rows
  from public.account_daily_stats d
  where d.account_id = acc.id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', x.id,
        'date', x.date,
        'symbol', x.symbol,
        'direction', x.direction,
        'result', x.result,
        'pnl_usd', x.pnl_usd,
        'r_value', x.r_value,
        'session', x.session,
        'model', x.model,
        'account_id', x.account_id,
        'created_at', x.created_at
      )
      order by x.date desc, x.created_at desc
    ),
    '[]'::jsonb
  )
  into trade_rows
  from (
    select t.*
    from public.trades t
    where t.account_id = acc.id
    order by t.date desc, t.created_at desc
    limit lim
  ) x;

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
    'stats', case
      when stats_row.account_id is null then null
      else public.journal_stats_json(
        stats_row.trade_count,
        stats_row.wins,
        stats_row.losses,
        stats_row.total_pnl,
        stats_row.gross_win,
        stats_row.gross_loss,
        stats_row.total_r,
        stats_row.best_streak,
        stats_row.worst_streak,
        stats_row.max_dd
      )
    end,
    'daily', coalesce(daily_rows, '[]'::jsonb),
    'trades', trade_rows,
    'trade_count', coalesce(total_count, 0),
    'trades_returned', jsonb_array_length(trade_rows),
    'trades_capped', coalesce(total_count, 0) > lim
  );
end;
$$;

revoke all on function public.get_published_trading_account(text, int) from public, anon;
grant execute on function public.get_published_trading_account(text, int) to anon, authenticated;

-- Backfill extended stats + daily for all accounts.
select public.refresh_account_trade_stats(array_agg(id))
from public.trading_accounts;

notify pgrst, 'reload schema';
