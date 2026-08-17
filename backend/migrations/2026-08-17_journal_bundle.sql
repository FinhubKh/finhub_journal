-- Server-side journal bundle: stats, daily series, breakdowns.
-- Avoids sending tens of thousands of trade rows to the browser.

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

  with scoped as (
    select
      t.id,
      t.date,
      t.created_at,
      t.result,
      t.r_value,
      t.symbol,
      t.session,
      t.account_id,
      case
        when p_account_id is null and a.pnl_denomination = 'cent'
          then coalesce(t.pnl_usd, 0) / 100.0
        else coalesce(t.pnl_usd, 0)
      end as pnl
    from public.trades t
    left join public.trading_accounts a on a.id = t.account_id and a.user_id = uid
    where t.user_id = uid
      and (p_account_id is null or t.account_id = p_account_id)
  ),
  agg as (
    select
      count(*)::int as total,
      count(*) filter (where result = 'win')::int as wins,
      count(*) filter (where result = 'loss')::int as losses,
      coalesce(sum(pnl), 0)::float8 as total_pnl,
      coalesce(sum(pnl) filter (where result = 'win'), 0)::float8 as gross_win,
      abs(coalesce(sum(pnl) filter (where result = 'loss'), 0))::float8 as gross_loss
    from scoped
  ),
  derived as (
    select
      a.*,
      case when a.wins > 0 then a.gross_win / a.wins else 0 end as avg_win,
      case when a.losses > 0 then a.gross_loss / a.losses else 0 end as avg_loss
    from agg a
  ),
  rstats as (
    select
      coalesce(sum(
        case
          when abs(coalesce(s.r_value, 0)) > 0.01 then s.r_value
          when d.avg_loss > 0 then s.pnl / d.avg_loss
          else 0
        end
      ), 0)::float8 as total_r
    from scoped s
    cross join derived d
  ),
  streaks as (
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
        from scoped
        where result in ('win', 'loss')
      ) islands
      group by result, grp
    ) g
  ),
  drawdown as (
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
          sum(pnl) over (order by date, created_at, id rows unbounded preceding) as cum
        from scoped
      ) c
    ) p
  ),
  daily as (
    select
      date,
      sum(pnl)::float8 as pnl,
      sum(coalesce(r_value, 0))::float8 as r_value,
      count(*)::int as trades,
      count(*) filter (where result = 'win')::int as wins,
      count(*) filter (where result = 'loss')::int as losses
    from scoped
    group by date
    order by date
  ),
  by_symbol as (
    select
      coalesce(nullif(trim(symbol), ''), 'Other') as name,
      count(*)::int as count,
      coalesce(sum(pnl), 0)::float8 as pnl,
      round((count(*) filter (where result = 'win'))::numeric / nullif(count(*), 0) * 100) as wr
    from scoped
    group by 1
    order by pnl desc
    limit 24
  ),
  by_session as (
    select
      coalesce(nullif(trim(session), ''), 'Other') as name,
      count(*)::int as count,
      coalesce(sum(pnl), 0)::float8 as pnl,
      round((count(*) filter (where result = 'win'))::numeric / nullif(count(*), 0) * 100) as wr
    from scoped
    group by 1
    order by pnl desc
    limit 24
  ),
  accounts as (
    select
      a.id as account_id,
      a.name,
      a.color,
      a.account_type,
      a.pnl_denomination,
      coalesce(s.trade_count, 0) as trade_count,
      coalesce(s.wins, 0) as wins,
      coalesce(s.losses, 0) as losses,
      coalesce(s.total_pnl, 0)::float8 as total_pnl
    from public.trading_accounts a
    left join public.account_trade_stats s on s.account_id = a.id
    where a.user_id = uid
      and coalesce(s.trade_count, 0) > 0
    order by s.total_pnl desc nulls last
  )
  select jsonb_build_object(
    'stats', case when d.total = 0 then null else jsonb_build_object(
      'total', d.total,
      'wins', d.wins,
      'losses', d.losses,
      'totalPnl', d.total_pnl,
      'wr', case when d.total > 0 then round((d.wins::numeric / d.total) * 100) else 0 end,
      'pf', case
        when d.gross_loss > 0 then to_char(round((d.gross_win / d.gross_loss)::numeric, 2), 'FM999999990.00')
        when d.gross_win > 0 then '∞'
        else '—'
      end,
      'avgWin', d.avg_win,
      'avgLoss', d.avg_loss,
      'rrRatio', case
        when d.avg_loss > 0 then to_char(round((d.avg_win / d.avg_loss)::numeric, 2), 'FM999999990.00')
        when d.avg_win > 0 then '∞'
        else '—'
      end,
      'avgR', case when d.total > 0 then r.total_r / d.total else 0 end,
      'expectancy', (d.wins::numeric / nullif(d.total, 0)) * d.avg_win
                    - (d.losses::numeric / nullif(d.total, 0)) * d.avg_loss,
      'bestStreak', st.best_streak,
      'worstStreak', st.worst_streak,
      'maxDD', dd.max_dd
    ) end,
    'daily', coalesce((select jsonb_agg(to_jsonb(d) order by d.date) from daily d), '[]'::jsonb),
    'breakdown', jsonb_build_object(
      'symbol', coalesce((select jsonb_agg(to_jsonb(b)) from by_symbol b), '[]'::jsonb),
      'session', coalesce((select jsonb_agg(to_jsonb(b)) from by_session b), '[]'::jsonb)
    ),
    'accounts', coalesce((select jsonb_agg(to_jsonb(a)) from accounts a), '[]'::jsonb)
  )
  into result
  from derived d
  cross join rstats r
  cross join streaks st
  cross join drawdown dd;

  return result;
end;
$$;

revoke all on function public.get_my_journal_bundle(uuid) from public, anon;
grant execute on function public.get_my_journal_bundle(uuid) to authenticated;

notify pgrst, 'reload schema';
