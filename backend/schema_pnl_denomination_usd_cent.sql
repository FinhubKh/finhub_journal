-- Remove auto-detect PnL mode; users choose USD or cent per account
update trading_accounts set pnl_denomination = 'usd' where pnl_denomination = 'auto';

alter table trading_accounts drop constraint if exists trading_accounts_pnl_denomination_check;
alter table trading_accounts
  alter column pnl_denomination set default 'usd';
alter table trading_accounts
  add constraint trading_accounts_pnl_denomination_check
  check (pnl_denomination in ('usd', 'cent'));
