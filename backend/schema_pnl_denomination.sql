-- PnL denomination per trading account (USD vs cent — user selects when creating account)
alter table trading_accounts
  add column if not exists pnl_denomination text not null default 'usd'
  check (pnl_denomination in ('usd', 'cent'));
