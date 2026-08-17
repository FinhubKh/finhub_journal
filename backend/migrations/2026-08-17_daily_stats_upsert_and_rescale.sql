-- USD↔cent PATCH storms were firing refresh_account_trade_stats concurrently.
-- Two sessions deleted then inserted the same (account_id, date) → 23505 on
-- account_daily_stats_pkey. Serialize refreshes and upsert daily rows.
-- Also rescale all trades for an account in one statement (one trigger fire).

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
end;
$$;

create or replace function public.rescale_account_pnl(
  p_account_id uuid,
  p_from text,
  p_to text
)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  v_factor numeric;
  v_count int := 0;
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if p_from not in ('usd', 'cent') or p_to not in ('usd', 'cent') then
    raise exception 'invalid denomination';
  end if;

  if p_from = p_to then
    return 0;
  end if;

  select a.name into v_name
  from public.trading_accounts a
  where a.id = p_account_id
    and a.user_id = auth.uid();

  if not found then
    raise exception 'account not found';
  end if;

  v_factor := case when p_to = 'cent' then 100 else 0.01 end;

  update public.trades t
  set
    pnl_usd = round((coalesce(t.pnl_usd, 0) * v_factor)::numeric, 2),
    result = case
      when round((coalesce(t.pnl_usd, 0) * v_factor)::numeric, 2) > 0 then 'win'
      when round((coalesce(t.pnl_usd, 0) * v_factor)::numeric, 2) < 0 then 'loss'
      else 'be'
    end
  where t.user_id = auth.uid()
    and (
      t.account_id = p_account_id
      or (t.account_id is null and t.account = v_name)
    );

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.rescale_account_pnl(uuid, text, text) from public;
grant execute on function public.rescale_account_pnl(uuid, text, text) to authenticated;
