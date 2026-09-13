-- ============================================================
-- FinhubKH Journal — trading account platform (MT4 / MT5)
-- Safe to re-run.
-- ============================================================

alter table trading_accounts
  add column if not exists platform text;

update trading_accounts
set platform = 'mt5'
where platform is null or platform = '';

alter table trading_accounts
  alter column platform set default 'mt5';

alter table trading_accounts
  drop constraint if exists trading_accounts_platform_check;

alter table trading_accounts
  add constraint trading_accounts_platform_check
  check (platform in ('mt4', 'mt5'));
