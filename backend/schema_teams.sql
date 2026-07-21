-- ============================================================
-- FinhubKH Journal — Team / Clan Leaderboard Schema & RPCs
-- Run this file in Supabase SQL Editor
-- ============================================================

-- 1. Create Teams Table
create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  tag text not null,
  description text default '',
  color text default '#7c3aed',
  invite_code text unique default upper(substring(md5(random()::text) from 1 for 8)),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz default now()
);

-- 2. Create Team Members Table (One team per user enforced by unique constraint on user_id)
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade unique,
  account_id uuid references public.trading_accounts(id) on delete set null,
  role text not null default 'member', -- 'leader', 'co-leader', 'member'
  joined_at timestamptz default now()
);

-- Indexes for performance
create index if not exists idx_team_members_team_id on public.team_members(team_id);
create index if not exists idx_team_members_user_id on public.team_members(user_id);
create index if not exists idx_teams_name on public.teams(name);

-- RLS setup
alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Policies for public reading
drop policy if exists "Teams are viewable by everyone" on public.teams;
create policy "Teams are viewable by everyone" on public.teams for select using (true);

drop policy if exists "Team members are viewable by everyone" on public.team_members;
create policy "Team members are viewable by everyone" on public.team_members for select using (true);

-- 3. RPC: Get Teams Leaderboard
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
        count(tr.id)::int as trade_count,
        count(*) filter (where tr.result = 'win')::int as wins,
        count(*) filter (where tr.result = 'loss')::int as losses,
        coalesce(sum(tr.pnl_usd), 0)::float8 as total_pnl
      from public.teams t
      left join public.team_members tm_leader on tm_leader.team_id = t.id and tm_leader.role = 'leader'
      left join public.profiles p_leader on p_leader.id = tm_leader.user_id
      left join public.team_members tm on tm.team_id = t.id
      left join public.trading_accounts a on a.id = tm.account_id and a.is_public = true
      left join public.trades tr on tr.account_id = a.id
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

revoke all on function public.get_teams_leaderboard(int, int) from public;
grant execute on function public.get_teams_leaderboard(int, int) to anon, authenticated;


-- 4. RPC: Get Team Details & Member Rankings
create or replace function public.get_team_details(
  p_team_id uuid
)
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
    t.id,
    t.name,
    t.tag,
    t.description,
    t.color,
    t.invite_code,
    t.created_at,
    t.created_by
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
        count(tr.id)::int as trade_count,
        count(*) filter (where tr.result = 'win')::int as wins,
        count(*) filter (where tr.result = 'loss')::int as losses,
        coalesce(sum(tr.pnl_usd), 0)::float8 as total_pnl,
        coalesce(sum(tr.pnl_usd) filter (where tr.result = 'win'), 0)::float8 as gross_win,
        abs(coalesce(sum(tr.pnl_usd) filter (where tr.result = 'loss'), 0))::float8 as gross_loss
      from public.team_members tm
      left join public.profiles p on p.id = tm.user_id
      left join public.trading_accounts a on a.id = tm.account_id and a.is_public = true
      left join public.trades tr on tr.account_id = a.id
      where tm.team_id = p_team_id
      group by tm.id, tm.user_id, tm.role, tm.joined_at, p.display_name, p.email, a.id, a.name, a.share_token, a.account_type
    ) ms
    order by ms.total_pnl desc nulls last, ms.trade_count desc
  ) m_ranked;

  return jsonb_build_object(
    'team', row_to_json(team_rec),
    'members', members_json
  );
end;
$$;

revoke all on function public.get_team_details(uuid) from public;
grant execute on function public.get_team_details(uuid) to anon, authenticated;


-- 5. RPC: Get User's Current Team Membership
create or replace function public.get_user_team()
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  curr_user_id uuid := auth.uid();
  res record;
begin
  if curr_user_id is null then
    return null;
  end if;

  select
    tm.id as member_id,
    tm.team_id,
    tm.role,
    tm.account_id,
    tm.joined_at,
    t.name as team_name,
    t.tag as team_tag,
    t.color as team_color,
    t.invite_code
  into res
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  where tm.user_id = curr_user_id;

  if res.team_id is null then
    return null;
  end if;

  return row_to_json(res);
end;
$$;

revoke all on function public.get_user_team() from public;
grant execute on function public.get_user_team() to authenticated;


-- 6. RPC: Create Team
create or replace function public.create_team(
  p_name text,
  p_tag text,
  p_description text default '',
  p_color text default '#7c3aed',
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  curr_user_id uuid := auth.uid();
  clean_name text := trim(p_name);
  clean_tag text := upper(trim(p_tag));
  new_team_id uuid;
  new_invite text;
begin
  if curr_user_id is null then
    raise exception 'Authentication required.';
  end if;

  if clean_name is null or length(clean_name) < 2 then
    raise exception 'Team name must be at least 2 characters long.';
  end if;

  if clean_tag is null or length(clean_tag) < 2 or length(clean_tag) > 6 then
    raise exception 'Team tag must be between 2 and 6 characters long.';
  end if;

  -- Check if user is already in a team
  if exists (select 1 from public.team_members where user_id = curr_user_id) then
    raise exception 'You are already a member of a team. Leave your current team first.';
  end if;

  -- Check if team name already taken
  if exists (select 1 from public.teams where lower(name) = lower(clean_name)) then
    raise exception 'A team with this name already exists.';
  end if;

  new_invite := upper(substring(md5(random()::text || clock_timestamp()::text) from 1 for 8));

  insert into public.teams (name, tag, description, color, invite_code, created_by)
  values (clean_name, clean_tag, coalesce(p_description, ''), coalesce(p_color, '#7c3aed'), new_invite, curr_user_id)
  returning id into new_team_id;

  insert into public.team_members (team_id, user_id, account_id, role)
  values (new_team_id, curr_user_id, p_account_id, 'leader');

  return public.get_team_details(new_team_id);
end;
$$;

revoke all on function public.create_team(text, text, text, text, uuid) from public;
grant execute on function public.create_team(text, text, text, text, uuid) to authenticated;


-- 7. RPC: Join Team
create or replace function public.join_team(
  p_team_id uuid default null,
  p_invite_code text default null,
  p_account_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
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

  insert into public.team_members (team_id, user_id, account_id, role)
  values (target_team_id, curr_user_id, p_account_id, 'member');

  return public.get_team_details(target_team_id);
end;
$$;

revoke all on function public.join_team(uuid, text, uuid) from public;
grant execute on function public.join_team(uuid, text, uuid) to authenticated;


-- 8. RPC: Leave Team
create or replace function public.leave_team()
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  curr_user_id uuid := auth.uid();
  user_mem record;
  member_cnt int;
  next_leader uuid;
begin
  if curr_user_id is null then
    raise exception 'Authentication required.';
  end if;

  select id, team_id, role into user_mem
  from public.team_members
  where user_id = curr_user_id;

  if user_mem.id is null then
    raise exception 'You are not in a team.';
  end if;

  select count(*)::int into member_cnt
  from public.team_members
  where team_id = user_mem.team_id;

  if member_cnt <= 1 then
    -- Last member, delete team
    delete from public.teams where id = user_mem.team_id;
  else
    -- If leaving user is leader, promote oldest member
    if user_mem.role = 'leader' then
      select id into next_leader
      from public.team_members
      where team_id = user_mem.team_id and user_id != curr_user_id
      order by joined_at asc
      limit 1;

      if next_leader is not null then
        update public.team_members set role = 'leader' where id = next_leader;
      end if;
    end if;

    delete from public.team_members where id = user_mem.id;
  end if;

  return true;
end;
$$;

revoke all on function public.leave_team() from public;
grant execute on function public.leave_team() to authenticated;


-- 9. RPC: Update Team Member Account
create or replace function public.update_team_member_account(
  p_account_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  curr_user_id uuid := auth.uid();
begin
  if curr_user_id is null then
    raise exception 'Authentication required.';
  end if;

  update public.team_members
  set account_id = p_account_id
  where user_id = curr_user_id;

  if not found then
    raise exception 'You are not currently in a team.';
  end if;

  return true;
end;
$$;

revoke all on function public.update_team_member_account(uuid) from public;
grant execute on function public.update_team_member_account(uuid) to authenticated;

notify pgrst, 'reload schema';
