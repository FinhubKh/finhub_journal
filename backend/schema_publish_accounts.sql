-- ============================================================
-- FinhubKH Journal — Publish trading accounts (public share links)
-- Run in Supabase SQL Editor (safe to re-run)
--
-- Public data is RPC-only (SECURITY DEFINER). Do NOT add public
-- SELECT policies on trading_accounts / trades — that would let
-- anyone enumerate all published accounts without a share token.
-- ============================================================

alter table trading_accounts
  add column if not exists is_public boolean not null default false;

alter table trading_accounts
  add column if not exists share_token text;

alter table trading_accounts
  add column if not exists published_at timestamptz;

create unique index if not exists trading_accounts_share_token_uidx
  on trading_accounts(share_token)
  where share_token is not null;

create index if not exists trading_accounts_is_public_idx
  on trading_accounts(is_public)
  where is_public = true;

-- Close open public SELECT (if previously applied)
drop policy if exists "Anyone can view published trading accounts" on trading_accounts;
drop policy if exists "Anyone can view trades of published accounts" on trades;

-- Owner: publish / unpublish (generates a stable share_token on first publish)
create or replace function public.set_trading_account_public(
  p_account_id uuid,
  p_is_public boolean
)
returns public.trading_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.trading_accounts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.trading_accounts a
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
  where a.id = p_account_id
    and a.user_id = auth.uid()
  returning * into row_out;

  if row_out.id is null then
    raise exception 'Account not found';
  end if;

  return row_out;
end;
$$;

revoke all on function public.set_trading_account_public(uuid, boolean) from public, anon;
grant execute on function public.set_trading_account_public(uuid, boolean) to authenticated;

-- Owner: rotate share token (invalidates old public links)
create or replace function public.regenerate_trading_account_share_token(
  p_account_id uuid
)
returns public.trading_accounts
language plpgsql
security definer
set search_path = public
as $$
declare
  row_out public.trading_accounts;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  update public.trading_accounts a
  set share_token = replace(gen_random_uuid()::text, '-', '')
  where a.id = p_account_id
    and a.user_id = auth.uid()
    and a.is_public = true
  returning * into row_out;

  if row_out.id is null then
    raise exception 'Account not found or not published';
  end if;

  return row_out;
end;
$$;

revoke all on function public.regenerate_trading_account_share_token(uuid) from public, anon;
grant execute on function public.regenerate_trading_account_share_token(uuid) to authenticated;

-- Drop old 1-arg overload if present (replaced by capped version)
drop function if exists public.get_published_trading_account(text);

-- Public bundle: account + owner display name + trades (no notes / sync keys / email)
-- Trades hard-capped (latest first) so large journals cannot dump unbounded payloads.
create or replace function public.get_published_trading_account(
  p_token text,
  p_limit int default 1000
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
  lim int := greatest(1, least(coalesce(p_limit, 1000), 1000));
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
