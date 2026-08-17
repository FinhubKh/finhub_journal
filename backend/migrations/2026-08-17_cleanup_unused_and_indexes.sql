-- Cleanup unused objects + indexes. Safe to re-run.

-- Legacy tables not used by the journal web or mobile apps.
drop table if exists public.signals cascade;
drop table if exists public.chart_drawings cascade;
drop table if exists public.bot_settings cascade;

-- Legacy leaderboard wrapper (app uses get_public_leaderboard).
drop function if exists public.get_leaderboard();

-- Never persist plaintext EA keys.
alter table public.sync_keys drop column if exists raw_key;

-- Redundant indexes (covered by a more specific index or unique constraint).
drop index if exists public.ai_performance_reports_user_id_idx;
drop index if exists public.compounding_accounts_user_id_idx;
drop index if exists public.compounding_trades_account_idx;
drop index if exists public.daily_pnl_user_date_idx;
drop index if exists public.trades_account_id_idx;
drop index if exists public.trades_user_date_idx;
drop index if exists public.trading_accounts_user_id_idx;
drop index if exists public.trading_accounts_is_public_idx;

-- Hot-path lookups missing covering indexes.
create index if not exists investor_credentials_user_id_idx
  on public.investor_credentials (user_id);

create index if not exists sync_keys_user_id_idx
  on public.sync_keys (user_id);

-- Covering index for public leaderboard / share aggregations.
create index if not exists trades_account_stats_idx
  on public.trades (account_id)
  include (result, pnl_usd)
  where account_id is not null;

analyze public.trades;
analyze public.trading_accounts;
analyze public.sync_keys;
analyze public.investor_credentials;
analyze public.profiles;

notify pgrst, 'reload schema';
