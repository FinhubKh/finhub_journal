-- ============================================================
-- FinhubKH Journal — Publish strategy backtests (public share links)
-- Run in Supabase SQL Editor (safe to re-run)
-- ============================================================

alter table public.strategy_backtests
  add column if not exists is_public boolean not null default false;

alter table public.strategy_backtests
  add column if not exists share_token text;

alter table public.strategy_backtests
  add column if not exists published_at timestamptz;

create unique index if not exists strategy_backtests_share_token_uidx
  on public.strategy_backtests(share_token)
  where share_token is not null;

create index if not exists strategy_backtests_is_public_idx
  on public.strategy_backtests(is_public)
  where is_public = true;

-- Owner: publish / unpublish (generates a stable share_token on first publish)
create or replace function public.set_backtest_public(
  p_backtest_id uuid,
  p_is_public boolean
)
returns public.strategy_backtests
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.strategy_backtests;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.strategy_backtests a
  set
    is_public = p_is_public,
    share_token = case
      when p_is_public and a.share_token is null then replace(gen_random_uuid()::text, '-', '')
      else a.share_token
    end,
    published_at = case
      when p_is_public then coalesce(a.published_at, now())
      else a.published_at
    end
  where a.id = p_backtest_id
    and a.user_id = auth.uid()
  returning * into row_out;

  if row_out is null then
    raise exception 'Backtest not found or permission denied';
  end if;

  return row_out;
end;
$$;

-- Owner: forcefully regenerate a share token
create or replace function public.regenerate_backtest_share_token(
  p_backtest_id uuid
)
returns public.strategy_backtests
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.strategy_backtests;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.strategy_backtests
  set share_token = replace(gen_random_uuid()::text, '-', '')
  where id = p_backtest_id
    and user_id = auth.uid()
    and is_public = true
  returning * into row_out;

  if row_out is null then
    raise exception 'Backtest not found, not published, or permission denied';
  end if;

  return row_out;
end;
$$;

-- Anyone (including anon): fetch a single backtest and its daily stats by token
create or replace function public.get_shared_backtest(
  p_token text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  bt public.strategy_backtests;
  daily_stats jsonb;
begin
  select * into bt
  from public.strategy_backtests
  where share_token = p_token
    and is_public = true
  limit 1;

  if bt is null then
    return null;
  end if;

  select coalesce(jsonb_agg(d order by date asc), '[]'::jsonb) into daily_stats
  from public.strategy_backtest_daily d
  where d.backtest_id = bt.id;

  return jsonb_build_object(
    'backtest', jsonb_build_object(
      'id', bt.id,
      'name', bt.name,
      'currency', bt.currency,
      'report_symbol', bt.report_symbol,
      'range_from', bt.range_from,
      'range_to', bt.range_to,
      'total_pnl', bt.total_pnl,
      'trade_count', bt.trade_count,
      'wins', bt.wins,
      'losses', bt.losses,
      'be_count', bt.be_count,
      'profit_factor', bt.profit_factor,
      'source_html', bt.source_html,
      'created_at', bt.created_at,
      'published_at', bt.published_at
    ),
    'daily', daily_stats
  );
end;
$$;
