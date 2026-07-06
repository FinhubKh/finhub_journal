-- ============================================================
-- FinhubKH Journal — Per-account EA sync keys
-- Run in Supabase SQL Editor after schema_mt_sync.sql
-- ============================================================

alter table sync_keys add column if not exists trading_account_id uuid references trading_accounts(id) on delete cascade;

-- Migrate legacy one-key-per-user rows to default (or first) trading account
update sync_keys sk
set trading_account_id = (
  select ta.id
  from trading_accounts ta
  where ta.user_id = sk.user_id
  order by ta.is_default desc, ta.created_at asc
  limit 1
)
where trading_account_id is null;

delete from sync_keys where trading_account_id is null;

alter table sync_keys drop constraint if exists sync_keys_user_id_key;

alter table sync_keys alter column trading_account_id set not null;

create unique index if not exists sync_keys_trading_account_id_unique
  on sync_keys(trading_account_id);

create unique index if not exists sync_keys_key_hash_unique
  on sync_keys(key_hash);
