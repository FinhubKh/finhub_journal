-- ============================================================
-- FinhubKH Journal — Public leaderboard (published accounts)
-- Run this entire file in Supabase SQL Editor
-- Replaces the old all-users get_leaderboard()
-- ============================================================

drop function if exists public.get_leaderboard();
drop function if exists public.get_public_leaderboard(int, int);
drop function if exists public.get_public_leaderboard();

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
      row_number() over (order by s.total_pnl desc nulls last, s.trade_count desc) as rank_pnl,
      s.account_id,
      s.account_name,
      s.share_token,
      s.account_type,
      s.pnl_denomination,
      s.color,
      s.published_at,
      s.display_name,
      s.trade_count,
      s.wins,
      s.losses,
      round(s.total_pnl::numeric, 2) as total_pnl,
      case
        when s.trade_count > 0 then round((s.wins::numeric / s.trade_count::numeric) * 100)
        else 0
      end as win_rate,
      case
        when s.gross_loss > 0 then round((s.gross_win / s.gross_loss)::numeric, 2)
        when s.gross_win > 0 then null
        else null
      end as profit_factor,
      case
        when s.gross_loss = 0 and s.gross_win > 0 then true
        else false
      end as profit_factor_infinite
    from (
      select
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
        count(t.id)::int as trade_count,
        count(*) filter (where t.result = 'win')::int as wins,
        count(*) filter (where t.result = 'loss')::int as losses,
        coalesce(sum(t.pnl_usd), 0)::float8 as total_pnl,
        coalesce(sum(t.pnl_usd) filter (where t.result = 'win'), 0)::float8 as gross_win,
        abs(coalesce(sum(t.pnl_usd) filter (where t.result = 'loss'), 0))::float8 as gross_loss
      from public.trading_accounts a
      left join public.profiles p on p.id = a.user_id
      left join public.trades t on t.account_id = a.id
      where a.is_public = true
        and a.share_token is not null
      group by
        a.id, a.name, a.share_token, a.account_type, a.pnl_denomination,
        a.color, a.published_at, p.display_name, p.email
      having count(t.id) >= min_trades
    ) s
    order by s.total_pnl desc nulls last, s.trade_count desc
    limit lim
  ) ranked;

  return jsonb_build_object(
    'entries', rows,
    'min_trades', min_trades,
    'limit', lim
  );
end;
$$;

revoke all on function public.get_public_leaderboard(int, int) from public;
grant execute on function public.get_public_leaderboard(int, int) to anon, authenticated;

-- Legacy name used by older scripts — same published-account leaderboard
create or replace function public.get_leaderboard()
returns jsonb
language sql
security definer
set search_path = public
stable
as $$
  select public.get_public_leaderboard(50, 5);
$$;

revoke all on function public.get_leaderboard() from public;
grant execute on function public.get_leaderboard() to anon, authenticated;

notify pgrst, 'reload schema';
