-- ============================================================
-- FinhubKH Journal — Investor-password bridge credentials
-- Run in Supabase SQL Editor after schema_trading_accounts.sql
-- Safe to re-run.
-- ============================================================

create table if not exists investor_credentials (
  id                  uuid default gen_random_uuid() primary key,
  user_id             uuid references auth.users on delete cascade not null,
  trading_account_id  uuid references trading_accounts(id) on delete cascade not null unique,
  broker_server       text not null,
  login               text not null,
  encrypted_password  text not null,
  last_synced_at      timestamptz,
  last_sync_error     text,
  created_at          timestamptz default now(),
  updated_at          timestamptz default now()
);

alter table investor_credentials enable row level security;

drop policy if exists "Users manage own investor credentials" on investor_credentials;
create policy "Users manage own investor credentials"
  on investor_credentials for all using (auth.uid() = user_id);

-- Note: /v1/investor-credentials and /v1/bridge/sync use the service_role
-- key, which bypasses RLS, to write/patch across users — same pattern as
-- sync_keys (see schema_mt_sync.sql).

-- Distinguish trades that arrived via the investor-password bridge from
-- the existing EA path (both used source='api' before this).
alter table trades drop constraint if exists trades_source_check;
alter table trades add constraint trades_source_check
  check (source in ('manual', 'api', 'investor_bridge'));
