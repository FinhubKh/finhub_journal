-- ============================================================
-- FinhubKH Journal — MetaAPI broker connect
-- Run after schema_trading_accounts.sql
-- ============================================================

alter table trading_accounts add column if not exists metaapi_account_id text;
alter table trading_accounts add column if not exists metaapi_server text;
alter table trading_accounts add column if not exists mt_login text;
alter table trading_accounts add column if not exists metaapi_platform text check (metaapi_platform in ('mt4', 'mt5'));
alter table trading_accounts add column if not exists metaapi_region text;
alter table trading_accounts add column if not exists connection_status text default 'disconnected';
alter table trading_accounts add column if not exists last_synced_at timestamptz;
alter table trading_accounts add column if not exists sync_error text;

alter table trades drop constraint if exists trades_source_check;
alter table trades add constraint trades_source_check
  check (source in ('manual', 'api', 'metaapi'));

-- Required for MetaAPI / EA upsert (onConflict: user_id,ticket)
drop index if exists trades_user_ticket_unique;
alter table trades drop constraint if exists trades_user_id_ticket_key;
alter table trades add constraint trades_user_id_ticket_key unique (user_id, ticket);
