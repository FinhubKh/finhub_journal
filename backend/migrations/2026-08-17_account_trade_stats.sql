-- Cached per-account trade stats so leaderboard / share / teams
-- do not scan thousands of trade rows on every request.

create table if not exists public.account_trade_stats (
  account_id uuid primary key references public.trading_accounts(id) on delete cascade,
  user_id uuid not null,
  trade_count int not null default 0,
  wins int not null default 0,
  losses int not null default 0,
  total_pnl double precision not null default 0,
  gross_win double precision not null default 0,
  gross_loss double precision not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists account_trade_stats_user_id_idx
  on public.account_trade_stats (user_id);

create index if not exists account_trade_stats_pnl_idx
  on public.account_trade_stats (total_pnl desc, trade_count desc);

alter table public.account_trade_stats enable row level security;

drop policy if exists "Users can view own account trade stats" on public.account_trade_stats;
create policy "Users can view own account trade stats"
  on public.account_trade_stats for select
  using (auth.uid() = user_id);

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

  insert into public.account_trade_stats (
    account_id, user_id, trade_count, wins, losses, total_pnl, gross_win, gross_loss, updated_at
  )
  select
    a.id,
    a.user_id,
    coalesce(x.trade_count, 0),
    coalesce(x.wins, 0),
    coalesce(x.losses, 0),
    coalesce(x.total_pnl, 0),
    coalesce(x.gross_win, 0),
    coalesce(x.gross_loss, 0),
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
  ) x on x.account_id = a.id
  where a.id = any(p_account_ids)
  on conflict (account_id) do update set
    user_id = excluded.user_id,
    trade_count = excluded.trade_count,
    wins = excluded.wins,
    losses = excluded.losses,
    total_pnl = excluded.total_pnl,
    gross_win = excluded.gross_win,
    gross_loss = excluded.gross_loss,
    updated_at = excluded.updated_at;
end;
$$;

create or replace function public.trg_refresh_account_trade_stats()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  ids uuid[];
begin
  if tg_op = 'INSERT' then
    select array_agg(distinct account_id) into ids from new_rows where account_id is not null;
  elsif tg_op = 'DELETE' then
    select array_agg(distinct account_id) into ids from old_rows where account_id is not null;
  else
    select array_agg(distinct account_id) into ids from (
      select account_id from new_rows where account_id is not null
      union
      select account_id from old_rows where account_id is not null
    ) u;
  end if;

  perform public.refresh_account_trade_stats(ids);
  return null;
end;
$$;

drop trigger if exists trades_refresh_stats_ins on public.trades;
create trigger trades_refresh_stats_ins
  after insert on public.trades
  referencing new table as new_rows
  for each statement
  execute function public.trg_refresh_account_trade_stats();

drop trigger if exists trades_refresh_stats_upd on public.trades;
create trigger trades_refresh_stats_upd
  after update on public.trades
  referencing old table as old_rows new table as new_rows
  for each statement
  execute function public.trg_refresh_account_trade_stats();

drop trigger if exists trades_refresh_stats_del on public.trades;
create trigger trades_refresh_stats_del
  after delete on public.trades
  referencing old table as old_rows
  for each statement
  execute function public.trg_refresh_account_trade_stats();

-- Backfill every existing account once.
select public.refresh_account_trade_stats(array_agg(id))
from public.trading_accounts;

-- ── Leaderboard: join cached stats instead of aggregating trades ──
create or replace function public.get_public_leaderboard(
  p_limit int default 50,
  p_min_trades int default 5
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lim int := greatest(1, least(coalesce(p_limit, 50), 100));
  min_trades int := greatest(0, least(coalesce(p_min_trades, 5), 1000));
  rows jsonb;
begin
  select coalesce(
    jsonb_agg(row_to_json(ranked)::jsonb order by ranked.rank_pnl),
    '[]'::jsonb
  )
  into rows
  from (
    select
      row_number() over (order by coalesce(s.total_pnl, 0) desc, coalesce(s.trade_count, 0) desc) as rank_pnl,
      a.id as account_id,
      a.name as account_name,
      a.share_token,
      a.account_type,
      a.pnl_denomination,
      a.color,
      a.published_at,
      coalesce(
        nullif(trim(p.display_name), ''),
        split_part(coalesce(p.email, ''), '@', 1),
        'Trader'
      ) as display_name,
      coalesce(s.trade_count, 0) as trade_count,
      coalesce(s.wins, 0) as wins,
      coalesce(s.losses, 0) as losses,
      round(coalesce(s.total_pnl, 0)::numeric, 2) as total_pnl,
      case
        when coalesce(s.trade_count, 0) > 0
          then round((s.wins::numeric / s.trade_count::numeric) * 100)
        else 0
      end as win_rate,
      case
        when coalesce(s.gross_loss, 0) > 0 then round((s.gross_win / s.gross_loss)::numeric, 2)
        else null
      end as profit_factor,
      (coalesce(s.gross_loss, 0) = 0 and coalesce(s.gross_win, 0) > 0) as profit_factor_infinite
    from public.trading_accounts a
    left join public.profiles p on p.id = a.user_id
    left join public.account_trade_stats s on s.account_id = a.id
    where a.is_public = true
      and a.share_token is not null
      and coalesce(s.trade_count, 0) >= min_trades
    order by coalesce(s.total_pnl, 0) desc, coalesce(s.trade_count, 0) desc
    limit lim
  ) ranked;

  return jsonb_build_object(
    'entries', rows,
    'min_trades', min_trades,
    'limit', lim
  );
end;
$$;

create or replace function public.get_teams_leaderboard(
  p_limit int default 50,
  p_min_trades int default 0
)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  lim int := greatest(1, least(coalesce(p_limit, 50), 100));
  rows jsonb;
begin
  select coalesce(
    jsonb_agg(row_to_json(ranked)::jsonb order by ranked.rank_pnl),
    '[]'::jsonb
  )
  into rows
  from (
    select
      row_number() over (order by ts.total_pnl desc nulls last, ts.member_count desc, ts.trade_count desc) as rank_pnl,
      ts.team_id,
      ts.team_name,
      ts.team_tag,
      ts.description,
      ts.color,
      ts.invite_code,
      ts.created_at,
      ts.leader_name,
      ts.member_count,
      ts.trade_count,
      ts.wins,
      ts.losses,
      round(ts.total_pnl::numeric, 2) as total_pnl,
      case
        when ts.trade_count > 0 then round((ts.wins::numeric / ts.trade_count::numeric) * 100)
        else 0
      end as win_rate
    from (
      select
        t.id as team_id,
        t.name as team_name,
        t.tag as team_tag,
        t.description,
        t.color,
        t.invite_code,
        t.created_at,
        coalesce(
          nullif(trim(p_leader.display_name), ''),
          split_part(coalesce(p_leader.email, ''), '@', 1),
          'Leader'
        ) as leader_name,
        count(distinct tm.user_id)::int as member_count,
        coalesce(sum(s.trade_count), 0)::int as trade_count,
        coalesce(sum(s.wins), 0)::int as wins,
        coalesce(sum(s.losses), 0)::int as losses,
        coalesce(sum(s.total_pnl), 0)::float8 as total_pnl
      from public.teams t
      left join public.team_members tm_leader on tm_leader.team_id = t.id and tm_leader.role = 'leader'
      left join public.profiles p_leader on p_leader.id = tm_leader.user_id
      left join public.team_members tm on tm.team_id = t.id
      left join public.trading_accounts a on a.id = tm.account_id and a.is_public = true
      left join public.account_trade_stats s on s.account_id = a.id
      group by t.id, t.name, t.tag, t.description, t.color, t.invite_code, t.created_at, p_leader.display_name, p_leader.email
    ) ts
    where ts.trade_count >= coalesce(p_min_trades, 0)
    order by ts.total_pnl desc nulls last, ts.member_count desc
    limit lim
  ) ranked;

  return jsonb_build_object(
    'entries', rows,
    'limit', lim
  );
end;
$$;

create or replace function public.get_team_details(p_team_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  team_rec record;
  members_json jsonb;
begin
  select
    t.id, t.name, t.tag, t.description, t.color, t.invite_code, t.created_at, t.created_by
  into team_rec
  from public.teams t
  where t.id = p_team_id;

  if team_rec.id is null then
    return null;
  end if;

  select coalesce(
    jsonb_agg(row_to_json(m_ranked)::jsonb order by m_ranked.rank_pnl),
    '[]'::jsonb
  )
  into members_json
  from (
    select
      row_number() over (order by ms.total_pnl desc nulls last, ms.trade_count desc) as rank_pnl,
      ms.member_id,
      ms.user_id,
      ms.role,
      ms.joined_at,
      ms.display_name,
      ms.account_id,
      ms.account_name,
      ms.share_token,
      ms.account_type,
      ms.trade_count,
      ms.wins,
      ms.losses,
      round(ms.total_pnl::numeric, 2) as total_pnl,
      case
        when ms.trade_count > 0 then round((ms.wins::numeric / ms.trade_count::numeric) * 100)
        else 0
      end as win_rate,
      case
        when ms.gross_loss > 0 then round((ms.gross_win / ms.gross_loss)::numeric, 2)
        else null
      end as profit_factor
    from (
      select
        tm.id as member_id,
        tm.user_id,
        tm.role,
        tm.joined_at,
        coalesce(
          nullif(trim(p.display_name), ''),
          split_part(coalesce(p.email, ''), '@', 1),
          'Trader'
        ) as display_name,
        a.id as account_id,
        a.name as account_name,
        a.share_token,
        a.account_type,
        coalesce(s.trade_count, 0)::int as trade_count,
        coalesce(s.wins, 0)::int as wins,
        coalesce(s.losses, 0)::int as losses,
        coalesce(s.total_pnl, 0)::float8 as total_pnl,
        coalesce(s.gross_win, 0)::float8 as gross_win,
        coalesce(s.gross_loss, 0)::float8 as gross_loss
      from public.team_members tm
      left join public.profiles p on p.id = tm.user_id
      left join public.trading_accounts a on a.id = tm.account_id and a.is_public = true
      left join public.account_trade_stats s on s.account_id = a.id
      where tm.team_id = p_team_id
    ) ms
    order by ms.total_pnl desc nulls last, ms.trade_count desc
  ) m_ranked;

  return jsonb_build_object(
    'team', row_to_json(team_rec),
    'members', members_json
  );
end;
$$;

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

  select coalesce(s.trade_count, 0) into total_count
  from public.account_trade_stats s
  where s.account_id = acc.id;

  if total_count is null then
    select count(*)::int into total_count
    from public.trades t
    where t.account_id = acc.id;
  end if;

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
    'trades', trade_rows,
    'trade_count', coalesce(total_count, 0),
    'trades_returned', jsonb_array_length(trade_rows),
    'trades_capped', coalesce(total_count, 0) > lim
  );
end;
$$;

notify pgrst, 'reload schema';
