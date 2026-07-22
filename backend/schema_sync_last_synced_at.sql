-- FinhubKH Journal — Track when each account last synced from MT5
-- Run in Supabase SQL Editor after schema_sync_keys_per_account.sql

alter table sync_keys
  add column if not exists last_synced_at timestamptz;
