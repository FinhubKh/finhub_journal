-- Master / EA risk eligibility: columns + refresh RPC, hooked into trade-stats.
-- Mirrors src/lib/riskEligibility.js. Apply in Supabase SQL editor (or usual migrate path).

alter table public.trading_accounts
  add column if not exists risk_track text,
  add column if not exists risk_eligible boolean not null default false,
  add column if not exists risk_failed_rules jsonb not null default '[]'::jsonb,
  add column if not exists risk_metrics jsonb not null default '{}'::jsonb,
  add column if not exists risk_checked_at timestamptz;

alter table public.trading_accounts
  drop constraint if exists trading_accounts_risk_track_check;

alter table public.trading_accounts
  add constraint trading_accounts_risk_track_check
  check (risk_track is null or risk_track in ('master', 'ea'));

create or replace function public.refresh_account_risk_eligibility(p_account_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
  track text;
  start_bal numeric;
  base numeric;
  peak numeric;
  days int;
  daily_pct numeric;
  overall_pct numeric;
  dd_abs numeric;
  dd_pct numeric;
  avg_loss numeric;
  breach_count int;
  streak_fail boolean;
  streak int;
  r text;
  failed jsonb;
  metrics jsonb;
  eligible boolean;
  trade_count int;
  owner_id uuid;
begin
  if p_account_ids is null or array_length(p_account_ids, 1) is null then
    return;
  end if;

  foreach aid in array p_account_ids loop
    if aid is null then
      continue;
    end if;

    select ta.risk_track, coalesce(ta.starting_balance, 0), ta.user_id
      into track, start_bal, owner_id
    from public.trading_accounts ta
    where ta.id = aid;

    if not found then
      continue;
    end if;

    -- Authenticated callers may only refresh their own accounts.
    -- Triggers / service_role typically have null auth.uid() and may refresh any id.
    if auth.uid() is not null
       and current_user is distinct from 'service_role'
       and owner_id is distinct from auth.uid() then
      continue;
    end if;

    if track is null then
      update public.trading_accounts set
        risk_eligible = false,
        risk_failed_rules = '[]'::jsonb,
        risk_metrics = '{}'::jsonb,
        risk_checked_at = now()
      where id = aid;
      continue;
    end if;

    -- Peak equity from trade PnL curve (max cumulative from 0; never negative).
    select greatest(coalesce(max(c), 0), 0) into peak
    from (
      select sum(coalesce(pnl_usd, 0)) over (
        order by date, created_at, id
        rows unbounded preceding
      ) as c
      from public.trades
      where account_id = aid
    ) s;

    base := case
      when start_bal > 0 then start_bal
      when peak > 0 then peak
      else 0
    end;
    failed := '[]'::jsonb;
    metrics := jsonb_build_object('equity_base', base, 'peak_equity', peak);

    if base <= 0 then
      update public.trading_accounts set
        risk_eligible = false,
        risk_failed_rules = '["equity_base_missing"]'::jsonb,
        risk_metrics = metrics,
        risk_checked_at = now()
      where id = aid;
      continue;
    end if;

    select count(*)::int,
           case
             when count(*) = 0 then 0
             else (max(date) - min(date)) + 1
           end
      into trade_count, days
    from public.trades
    where account_id = aid;
    days := coalesce(days, 0);
    trade_count := coalesce(trade_count, 0);
    metrics := metrics || jsonb_build_object('history_days', days);
    if days < 182 then
      failed := failed || '["history_6m"]'::jsonb;
    end if;

    -- Max daily loss pct from account_daily_stats.pnl (0 when no losing days).
    select coalesce(abs(min(pnl)), 0) / base into daily_pct
    from public.account_daily_stats
    where account_id = aid
      and pnl < 0;
    daily_pct := coalesce(daily_pct, 0);
    metrics := metrics || jsonb_build_object('max_daily_loss_pct', daily_pct);
    if daily_pct > 0.01 then
      failed := failed || '["daily_loss_1pct"]'::jsonb;
    end if;

    -- Worst cumulative loss from start / equity_base.
    select coalesce(abs(min(c)), 0) / base into overall_pct
    from (
      select sum(coalesce(pnl_usd, 0)) over (
        order by date, created_at, id
        rows unbounded preceding
      ) as c
      from public.trades
      where account_id = aid
    ) s
    where c < 0;
    overall_pct := coalesce(overall_pct, 0);
    metrics := metrics || jsonb_build_object('max_overall_loss_pct', overall_pct);
    if overall_pct > 0.10 then
      failed := failed || '["overall_loss_10pct"]'::jsonb;
    end if;

    select coalesce(ats.max_dd, 0) into dd_abs
    from public.account_trade_stats ats
    where ats.account_id = aid;
    dd_abs := coalesce(dd_abs, 0);
    dd_pct := dd_abs / base;
    metrics := metrics || jsonb_build_object('max_dd_pct', dd_pct);
    if dd_pct > 0.10 then
      failed := failed || '["max_dd_10pct"]'::jsonb;
    end if;

    -- avg |loss| matching JS: abs(sum(pnl)) / count for result = loss
    select coalesce(
      abs(sum(coalesce(pnl_usd, 0))) / nullif(count(*), 0),
      0
    ) into avg_loss
    from public.trades
    where account_id = aid
      and result = 'loss';
    avg_loss := coalesce(avg_loss, 0);

    -- Risk per trade: prefer |r| * avg_loss when usable R; else |pnl| on losses.
    select count(*)::int into breach_count
    from public.trades t
    where t.account_id = aid
      and (
        case
          when abs(coalesce(t.r_value, 0)) > 0.01 and avg_loss > 0
            then abs(t.r_value) * avg_loss
          when t.result = 'loss'
            then abs(coalesce(t.pnl_usd, 0))
          else null
        end
      ) / base > 0.01 + 1e-9;
    breach_count := coalesce(breach_count, 0);
    metrics := metrics || jsonb_build_object('risk_per_trade_breaches', breach_count);
    if breach_count > 0 then
      failed := failed || '["risk_per_trade_1pct"]'::jsonb;
    end if;

    if track = 'master' then
      -- Explicit consecutive-loss scan (wins reset; BE / other leave streak).
      streak_fail := false;
      streak := 0;
      for r in
        select t.result
        from public.trades t
        where t.account_id = aid
        order by t.date, t.created_at, t.id
      loop
        if r = 'loss' then
          streak := streak + 1;
          if streak >= 3 then
            streak_fail := true;
            exit;
          end if;
        elsif r = 'win' then
          streak := 0;
        end if;
      end loop;
      metrics := metrics || jsonb_build_object('losing_streak_3', streak_fail);
      if streak_fail then
        failed := failed || '["losing_streak_3"]'::jsonb;
      end if;
    end if;

    if track = 'ea' then
      -- perf_report_ready: at least one trade day of history
      metrics := metrics || jsonb_build_object(
        'perf_report_ready',
        trade_count > 0 and days >= 1
      );
      if not (trade_count > 0 and days >= 1) then
        failed := failed || '["perf_report_ready"]'::jsonb;
      end if;
    end if;

    eligible := jsonb_array_length(failed) = 0;
    update public.trading_accounts set
      risk_eligible = eligible,
      risk_failed_rules = failed,
      risk_metrics = metrics,
      risk_checked_at = now()
    where id = aid;
  end loop;
end;
$$;

revoke all on function public.refresh_account_risk_eligibility(uuid[]) from public, anon;
grant execute on function public.refresh_account_risk_eligibility(uuid[]) to authenticated, service_role;

-- Recreate refresh_account_trade_stats from 2026-08-17_daily_stats_upsert_and_rescale.sql
-- and append risk eligibility refresh so public badges stay live after trade changes.
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

  -- Lock accounts in id order so overlapping refreshes cannot deadlock.
  perform pg_advisory_xact_lock(871734, hashtext(aid::text))
  from (
    select distinct x as aid
    from unnest(p_account_ids) as x
    where x is not null
    order by 1
  ) s;

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
  group by t.account_id, t.date
  on conflict (account_id, date) do update set
    pnl = excluded.pnl,
    r_value = excluded.r_value,
    trades = excluded.trades,
    wins = excluded.wins,
    losses = excluded.losses;

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

  perform public.refresh_account_risk_eligibility(p_account_ids);
end;
$$;

-- Recreate get_published_trading_account from 2026-08-17_fix_published_account_limit.sql
-- with risk_track / risk_eligible for public Master / EA Safe badges.
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

  select count(*)::int into total_count
  from public.trades t
  where t.account_id = acc.id;

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
      'created_at', acc.created_at,
      'risk_track', acc.risk_track,
      'risk_eligible', acc.risk_eligible
    ),
    'owner', jsonb_build_object(
      'display_name', coalesce(owner_name, 'Trader')
    ),
    'trades', trade_rows,
    'trade_count', total_count,
    'trades_returned', jsonb_array_length(trade_rows),
    'trades_capped', total_count > lim
  );
end;
$$;

revoke all on function public.get_published_trading_account(text, int) from public, anon;
grant execute on function public.get_published_trading_account(text, int) to anon, authenticated;
