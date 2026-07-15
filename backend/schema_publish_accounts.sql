-- ============================================================
-- FinhubKH Journal — Publish trading accounts (public share links)
-- Run in Supabase SQL Editor
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

-- Public can read published account rows (owners still use their own policy)
drop policy if exists "Anyone can view published trading accounts" on trading_accounts;
create policy "Anyone can view published trading accounts"
  on trading_accounts for select
  using (is_public = true and share_token is not null);

-- Public can read trades that belong to a published account
drop policy if exists "Anyone can view trades of published accounts" on trades;
create policy "Anyone can view trades of published accounts"
  on trades for select
  using (
    exists (
      select 1
      from public.trading_accounts a
      where a.id = trades.account_id
        and a.is_public = true
        and a.share_token is not null
    )
  );

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

-- Public bundle: account + owner display name + trades (no sync keys / email)
create or replace function public.get_published_trading_account(p_token text)
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

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', t.id,
        'date', t.date,
        'symbol', t.symbol,
        'direction', t.direction,
        'result', t.result,
        'pnl_usd', t.pnl_usd,
        'r_value', t.r_value,
        'session', t.session,
        'model', t.model,
        'notes', t.notes,
        'account_id', t.account_id,
        'created_at', t.created_at
      )
      order by t.date desc, t.created_at desc
    ),
    '[]'::jsonb
  )
  into trade_rows
  from public.trades t
  where t.account_id = acc.id;

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
    'trades', trade_rows
  );
end;
$$;

revoke all on function public.get_published_trading_account(text) from public, anon;
grant execute on function public.get_published_trading_account(text) to anon, authenticated;
