-- Fix get_published_trading_account: define lim and always cap trades.
-- Apply in Supabase SQL editor (or via migration) after deploy.

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
      'created_at', acc.created_at
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
