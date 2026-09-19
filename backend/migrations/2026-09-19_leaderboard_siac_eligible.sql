-- Public leaderboard: expose SIAC eligibility + optional eligible-only filter.
-- Rankings for SIAC mode = published + risk_eligible, ordered by net PnL.

drop function if exists public.get_public_leaderboard(int, int);
drop function if exists public.get_public_leaderboard(int, int, boolean);

create or replace function public.get_public_leaderboard(
  p_limit int default 50,
  p_min_trades int default 5,
  p_eligible_only boolean default false
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
$$;

revoke all on function public.get_public_leaderboard(int, int, boolean) from public;
grant execute on function public.get_public_leaderboard(int, int, boolean) to anon, authenticated;

notify pgrst, 'reload schema';
