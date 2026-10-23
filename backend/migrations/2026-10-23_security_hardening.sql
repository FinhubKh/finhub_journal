-- Security hardening (2026-10-23 audit).
-- 1. trades / account_cashflows: account_id must belong to the caller (blocked
--    injecting trades into another user's account to skew their stats/leaderboard).
-- 2. join_team / update_team_member_account: only your own trading account.
-- 3. refresh_account_trade_stats + trigger helpers: not callable via RPC.
-- 4. Public display names no longer fall back to the email local-part.
-- Service-role writers (EA / bridge / investor sync) bypass RLS and are unaffected.
-- Run: supabase db query --linked -f backend/migrations/2026-10-23_security_hardening.sql

begin;

-- ── 1. Account ownership on trades / cashflows ──
drop policy if exists "Users can insert own trades" on public.trades;
create policy "Users can insert own trades"
  on public.trades for insert
  with check (auth.uid() = user_id and (account_id is null or exists (select 1 from public.trading_accounts a where a.id = account_id and a.user_id = auth.uid())));

drop policy if exists "Users can update own trades" on public.trades;
create policy "Users can update own trades"
  on public.trades for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (account_id is null or exists (select 1 from public.trading_accounts a where a.id = account_id and a.user_id = auth.uid())));

drop policy if exists "Users can insert own cashflows" on public.account_cashflows;
create policy "Users can insert own cashflows"
  on public.account_cashflows for insert
  with check (auth.uid() = user_id and (account_id is null or exists (select 1 from public.trading_accounts a where a.id = account_id and a.user_id = auth.uid())));

drop policy if exists "Users can update own cashflows" on public.account_cashflows;
create policy "Users can update own cashflows"
  on public.account_cashflows for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id and (account_id is null or exists (select 1 from public.trading_accounts a where a.id = account_id and a.user_id = auth.uid())));

-- ── 2. Team account ownership ──
CREATE OR REPLACE FUNCTION public.join_team(p_team_id uuid DEFAULT NULL::uuid, p_invite_code text DEFAULT NULL::text, p_account_id uuid DEFAULT NULL::uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  curr_user_id uuid := auth.uid();
  target_team_id uuid := p_team_id;
begin
  if curr_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if exists (select 1 from public.team_members where user_id = curr_user_id) then
    raise exception 'You are already in a team. Leave your current team first.';
  end if;

  if target_team_id is null and p_invite_code is not null then
    select id into target_team_id from public.teams where upper(invite_code) = upper(trim(p_invite_code));
  end if;

  if target_team_id is null then
    raise exception 'Team not found or invalid invite code.';
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.trading_accounts a where a.id = p_account_id and a.user_id = curr_user_id
  ) then
    raise exception 'Trading account not found.';
  end if;

  insert into public.team_members (team_id, user_id, account_id, role)
  values (target_team_id, curr_user_id, p_account_id, 'member');

  return public.get_team_details(target_team_id);
end;
$function$;

CREATE OR REPLACE FUNCTION public.update_team_member_account(p_account_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  curr_user_id uuid := auth.uid();
begin
  if curr_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.trading_accounts a where a.id = p_account_id and a.user_id = curr_user_id
  ) then
    raise exception 'Trading account not found.';
  end if;

  update public.team_members
  set account_id = p_account_id
  where user_id = curr_user_id;

  if not found then
    raise exception 'You are not currently in a team.';
  end if;

  return true;
end;
$function$;

-- ── 3. Internal stats / embedding helpers are trigger-only ──
revoke all on function public.refresh_account_trade_stats(uuid[]) from public, anon, authenticated;
grant execute on function public.refresh_account_trade_stats(uuid[]) to service_role;
revoke all on function public.trg_refresh_account_trade_stats() from public, anon, authenticated;
revoke all on function public.sync_trade_embedding() from public, anon, authenticated;
revoke all on function public.cleanup_trade_embedding() from public, anon, authenticated;
revoke all on function public.sync_daily_note_embedding() from public, anon, authenticated;
revoke all on function public.cleanup_daily_note_embedding() from public, anon, authenticated;

-- ── 4. No email-derived names on public endpoints ──
CREATE OR REPLACE FUNCTION public.get_public_leaderboard(p_limit integer DEFAULT 50, p_min_trades integer DEFAULT 5, p_eligible_only boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  lim int := greatest(1, least(coalesce(p_limit, 50), 100));
  min_trades int := greatest(0, least(coalesce(p_min_trades, 5), 1000));
  eligible_only boolean := coalesce(p_eligible_only, false);
  rows jsonb;
begin
  select coalesce(
    jsonb_agg(row_to_json(ranked)::jsonb order by ranked.rank_pnl),
    '[]'::jsonb
  )
  into rows
  from (
    select
      row_number() over (
        order by coalesce(s.total_pnl, 0) desc, coalesce(s.trade_count, 0) desc
      ) as rank_pnl,
      a.id as account_id,
      a.name as account_name,
      a.share_token,
      a.account_type,
      a.pnl_denomination,
      a.color,
      a.published_at,
      a.risk_track,
      a.risk_eligible,
      coalesce(
        nullif(trim(p.display_name), ''),
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
      and (not eligible_only or a.risk_eligible = true)
    order by coalesce(s.total_pnl, 0) desc, coalesce(s.trade_count, 0) desc
    limit lim
  ) ranked;

  return jsonb_build_object(
    'entries', rows,
    'min_trades', min_trades,
    'limit', lim,
    'eligible_only', eligible_only
  );
end;
$function$;

CREATE OR REPLACE FUNCTION public.get_teams_leaderboard(p_limit integer DEFAULT 50, p_min_trades integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      group by t.id, t.name, t.tag, t.description, t.color, t.invite_code, t.created_at, p_leader.display_name
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
$function$;

CREATE OR REPLACE FUNCTION public.get_team_details(p_team_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$;

CREATE OR REPLACE FUNCTION public.get_published_trading_account(p_token text, p_limit integer DEFAULT NULL::integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  select coalesce(nullif(trim(p.display_name), ''), 'Trader')
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
$function$;

commit;
