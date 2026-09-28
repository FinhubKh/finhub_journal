-- Admin detail RPCs for user + trading account inspection.

create or replace function public.admin_get_user_detail(target_user_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if target_user_id is null then
    raise exception 'User id required';
  end if;

  select jsonb_build_object(
    'profile', (
      select jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'display_name', p.display_name,
        'role', p.role,
        'created_at', p.created_at
      )
      from public.profiles p
      where p.id = target_user_id
    ),
    'accounts', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', ta.id,
          'name', ta.name,
          'account_type', ta.account_type,
          'broker', ta.broker,
          'pnl_denomination', ta.pnl_denomination,
          'starting_balance', ta.starting_balance,
          'is_default', ta.is_default,
          'is_public', ta.is_public,
          'connection_status', ta.connection_status,
          'risk_track', ta.risk_track,
          'risk_eligible', ta.risk_eligible,
          'risk_failed_rules', ta.risk_failed_rules,
          'created_at', ta.created_at,
          'trade_count', coalesce(s.trade_count, 0),
          'wins', coalesce(s.wins, 0),
          'losses', coalesce(s.losses, 0),
          'total_pnl', coalesce(s.total_pnl, 0),
          'max_dd', coalesce(s.max_dd, 0),
          'last_synced_at', sk.last_synced_at,
          'has_sync_key', sk.id is not null
        )
        order by ta.created_at desc
      )
      from public.trading_accounts ta
      left join public.account_trade_stats s on s.account_id = ta.id
      left join public.sync_keys sk on sk.trading_account_id = ta.id
      where ta.user_id = target_user_id
    ), '[]'::jsonb),
    'sync_keys', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', sk.id,
          'trading_account_id', sk.trading_account_id,
          'account_name', ta.name,
          'created_at', sk.created_at,
          'last_synced_at', sk.last_synced_at
        )
        order by sk.created_at desc
      )
      from public.sync_keys sk
      left join public.trading_accounts ta on ta.id = sk.trading_account_id
      where sk.user_id = target_user_id
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id', t.id,
          'name', t.name,
          'tag', t.tag,
          'role', tm.role,
          'joined_at', tm.joined_at
        )
        order by tm.joined_at desc nulls last
      )
      from public.team_members tm
      join public.teams t on t.id = tm.team_id
      where tm.user_id = target_user_id
    ), '[]'::jsonb),
    'summary', (
      select jsonb_build_object(
        'account_count', (select count(*)::int from public.trading_accounts where user_id = target_user_id),
        'sync_key_count', (select count(*)::int from public.sync_keys where user_id = target_user_id),
        'trade_count', coalesce((select sum(trade_count)::int from public.account_trade_stats where user_id = target_user_id), 0),
        'total_pnl', coalesce((select sum(total_pnl) from public.account_trade_stats where user_id = target_user_id), 0)
      )
    )
  ) into result;

  if result->'profile' is null then
    raise exception 'User not found';
  end if;

  return result;
end;
$$;

create or replace function public.admin_get_account_detail(target_account_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if target_account_id is null then
    raise exception 'Account id required';
  end if;

  select jsonb_build_object(
    'account', (
      select jsonb_build_object(
        'id', ta.id,
        'user_id', ta.user_id,
        'name', ta.name,
        'slug', ta.slug,
        'account_type', ta.account_type,
        'broker', ta.broker,
        'starting_balance', ta.starting_balance,
        'color', ta.color,
        'is_default', ta.is_default,
        'connection_status', ta.connection_status,
        'pnl_denomination', ta.pnl_denomination,
        'is_public', ta.is_public,
        'share_token', ta.share_token,
        'published_at', ta.published_at,
        'risk_track', ta.risk_track,
        'risk_eligible', ta.risk_eligible,
        'risk_failed_rules', ta.risk_failed_rules,
        'risk_metrics', ta.risk_metrics,
        'risk_checked_at', ta.risk_checked_at,
        'created_at', ta.created_at
      )
      from public.trading_accounts ta
      where ta.id = target_account_id
    ),
    'owner', (
      select jsonb_build_object(
        'id', p.id,
        'email', p.email,
        'display_name', p.display_name,
        'role', p.role,
        'created_at', p.created_at
      )
      from public.trading_accounts ta
      join public.profiles p on p.id = ta.user_id
      where ta.id = target_account_id
    ),
    'stats', (
      select jsonb_build_object(
        'trade_count', coalesce(s.trade_count, 0),
        'wins', coalesce(s.wins, 0),
        'losses', coalesce(s.losses, 0),
        'total_pnl', coalesce(s.total_pnl, 0),
        'gross_win', coalesce(s.gross_win, 0),
        'gross_loss', coalesce(s.gross_loss, 0),
        'max_dd', coalesce(s.max_dd, 0),
        'updated_at', s.updated_at
      )
      from public.account_trade_stats s
      where s.account_id = target_account_id
    ),
    'sync_key', (
      select jsonb_build_object(
        'id', sk.id,
        'created_at', sk.created_at,
        'last_synced_at', sk.last_synced_at
      )
      from public.sync_keys sk
      where sk.trading_account_id = target_account_id
    ),
    'trades', coalesce((
      select jsonb_agg(row_to_json(x)::jsonb)
      from (
        select
          t.id,
          t.date,
          t.symbol,
          t.direction,
          t.result,
          t.pnl_usd,
          t.r_value,
          t.close_time,
          t.open_time,
          t.ticket,
          t.lot_size,
          t.entry_price,
          t.exit_price
        from public.trades t
        where t.account_id = target_account_id
        order by coalesce(t.close_time, t.date::timestamptz) desc nulls last, t.created_at desc
      ) x
    ), '[]'::jsonb)
  ) into result;

  if result->'account' is null then
    raise exception 'Account not found';
  end if;

  return result;
end;
$$;

grant execute on function public.admin_get_user_detail(uuid) to authenticated;
grant execute on function public.admin_get_account_detail(uuid) to authenticated;
revoke all on function public.admin_get_user_detail(uuid) from public, anon;
revoke all on function public.admin_get_account_detail(uuid) from public, anon;
