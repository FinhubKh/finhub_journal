-- Fires an async call to the `embed` edge function whenever a trade's or
-- daily_pnl's notes change, so journal_embeddings stays in sync regardless
-- of which code path wrote the note (manual entry, EA sync, CSV import).
-- Run in Supabase SQL Editor.
--
-- REQUIRES manual one-time setup after this file runs (values are
-- environment-specific and must never be committed to git):
--
--   select vault.create_secret(
--     'https://<your-project-ref>.supabase.co/functions/v1/embed',
--     'embed_function_url'
--   );
--   select vault.create_secret(
--     '<same random value you set as EMBED_FUNCTION_SECRET in Vercel and
--       as the embed function''s EMBED_FUNCTION_SECRET secret>',
--     'embed_function_secret'
--   );
--
-- Until both vault secrets exist, the triggers below no-op silently
-- (see the `if fn_url is null` guard) — trades/daily_pnl writes are
-- never blocked by a missing embedding config.

create extension if not exists pg_net with schema extensions;

create or replace function public.sync_trade_embedding()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  fn_url text;
  fn_secret text;
  note text;
begin
  if tg_op = 'UPDATE' and new.notes is not distinct from old.notes then
    return new;
  end if;

  note := nullif(trim(coalesce(new.notes, '')), '');

  if note is null then
    delete from public.journal_embeddings
      where source_type = 'trade' and source_id = new.id;
    return new;
  end if;

  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'embed_function_url';
  select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'embed_function_secret';

  if fn_url is null or fn_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-embed-secret', fn_secret),
    body := jsonb_build_object(
      'source_type', 'trade',
      'source_id', new.id,
      'user_id', new.user_id,
      'account_id', new.account_id,
      'content', note,
      'metadata', jsonb_build_object(
        'date', new.date,
        'symbol', new.symbol,
        'direction', new.direction,
        'session', new.session,
        'result', new.result,
        'r_value', new.r_value,
        'pnl_usd', new.pnl_usd
      )
    )
  );

  return new;
end;
$$;

create or replace function public.cleanup_trade_embedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.journal_embeddings where source_type = 'trade' and source_id = old.id;
  return old;
end;
$$;

drop trigger if exists trades_sync_embedding on public.trades;
create trigger trades_sync_embedding
  after insert or update of notes on public.trades
  for each row execute function public.sync_trade_embedding();

drop trigger if exists trades_cleanup_embedding on public.trades;
create trigger trades_cleanup_embedding
  after delete on public.trades
  for each row execute function public.cleanup_trade_embedding();

create or replace function public.sync_daily_note_embedding()
returns trigger
language plpgsql
security definer
set search_path = public, extensions, vault
as $$
declare
  fn_url text;
  fn_secret text;
  note text;
begin
  if tg_op = 'UPDATE' and new.notes is not distinct from old.notes then
    return new;
  end if;

  note := nullif(trim(coalesce(new.notes, '')), '');

  if note is null then
    delete from public.journal_embeddings
      where source_type = 'daily_note' and source_id = new.id;
    return new;
  end if;

  select decrypted_secret into fn_url from vault.decrypted_secrets where name = 'embed_function_url';
  select decrypted_secret into fn_secret from vault.decrypted_secrets where name = 'embed_function_secret';

  if fn_url is null or fn_secret is null then
    return new;
  end if;

  perform net.http_post(
    url := fn_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-embed-secret', fn_secret),
    body := jsonb_build_object(
      'source_type', 'daily_note',
      'source_id', new.id,
      'user_id', new.user_id,
      'account_id', null,
      'content', note,
      'metadata', jsonb_build_object(
        'date', new.date,
        'pnl_usd', new.pnl_usd,
        'trade_count', new.trade_count
      )
    )
  );

  return new;
end;
$$;

create or replace function public.cleanup_daily_note_embedding()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.journal_embeddings where source_type = 'daily_note' and source_id = old.id;
  return old;
end;
$$;

drop trigger if exists daily_pnl_sync_embedding on public.daily_pnl;
create trigger daily_pnl_sync_embedding
  after insert or update of notes on public.daily_pnl
  for each row execute function public.sync_daily_note_embedding();

drop trigger if exists daily_pnl_cleanup_embedding on public.daily_pnl;
create trigger daily_pnl_cleanup_embedding
  after delete on public.daily_pnl
  for each row execute function public.cleanup_daily_note_embedding();
