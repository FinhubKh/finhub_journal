-- FinhubKH Journal — One-shot cashflow backfill flag for investor sync
-- Run in Supabase SQL Editor after schema_investor_sync_stage.sql

alter table investor_credentials
  add column if not exists cashflow_backfill_done_at timestamptz;
