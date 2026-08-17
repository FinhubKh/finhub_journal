-- MT5 deposits / withdrawals / other balance ops. Kept off `trades` so win rate stays clean.

create table if not exists public.account_cashflows (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid not null references auth.users on delete cascade,
  account_id   uuid not null references public.trading_accounts(id) on delete cascade,
  ticket       bigint not null,
  op_type      text not null check (op_type in (
                 'deposit', 'withdrawal', 'credit', 'bonus',
                 'charge', 'correction', 'interest', 'other')),
  amount       numeric(14,2) not null,
  comment      text,
  occurred_at  timestamptz not null,
  date         date not null,
  source       text not null check (source in ('api', 'investor_bridge')),
  created_at   timestamptz not null default now(),
  unique (account_id, ticket)
);

create index if not exists account_cashflows_user_date_idx
  on public.account_cashflows (user_id, date desc);

create index if not exists account_cashflows_account_id_idx
  on public.account_cashflows (account_id);

alter table public.account_cashflows enable row level security;

drop policy if exists "Users can view own cashflows" on public.account_cashflows;
create policy "Users can view own cashflows"
  on public.account_cashflows for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own cashflows" on public.account_cashflows;
create policy "Users can insert own cashflows"
  on public.account_cashflows for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own cashflows" on public.account_cashflows;
create policy "Users can update own cashflows"
  on public.account_cashflows for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own cashflows" on public.account_cashflows;
create policy "Users can delete own cashflows"
  on public.account_cashflows for delete using (auth.uid() = user_id);

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
      case
        when p_account_id is not null then coalesce(max(max_dd), 0)::float8
        else coalesce(max(max_dd * usd_factor), 0)::float8
      end as max_dd
    from accounts_scope
  ),
  cashflow as (
    select
      coalesce(sum(scaled) filter (where scaled > 0), 0)::float8 as deposits,
      coalesce(abs(sum(scaled) filter (where scaled < 0)), 0)::float8 as withdrawals,
      coalesce(sum(scaled), 0)::float8 as net
    from (
      select
        case
          when p_account_id is null and a.pnl_denomination = 'cent' then c.amount / 100.0
          else c.amount
        end as scaled
      from public.account_cashflows c
      join public.trading_accounts a on a.id = c.account_id
      where a.user_id = uid
        and (p_account_id is null or c.account_id = p_account_id)
    ) x
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
    'stats', coalesce(
      public.journal_stats_json(
        s.total, s.wins, s.losses, s.total_pnl, s.gross_win, s.gross_loss, s.total_r,
        s.best_streak, s.worst_streak,
        case when p_account_id is null then pd.max_dd else s.max_dd end
      ),
      jsonb_build_object(
        'total', 0, 'wins', 0, 'losses', 0, 'totalPnl', 0, 'wr', 0, 'pf', '—',
        'avgWin', 0, 'avgLoss', 0, 'rrRatio', '—', 'avgR', 0, 'expectancy', 0,
        'bestStreak', 0, 'worstStreak', 0, 'maxDD', 0
      )
    ) || jsonb_build_object(
      'deposits', cf.deposits,
      'withdrawals', cf.withdrawals,
      'netCashflow', cf.net,
      'balance', s.total_pnl + cf.net
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
  cross join portfolio_dd pd
  cross join cashflow cf;

  return result;
end;
$$;

revoke all on function public.get_my_journal_bundle(uuid) from public, anon;
grant execute on function public.get_my_journal_bundle(uuid) to authenticated;
