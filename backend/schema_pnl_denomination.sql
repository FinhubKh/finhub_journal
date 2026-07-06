-- PnL denomination per trading account (USD vs cent vs EA auto-detect)
alter table trading_accounts
  add column if not exists pnl_denomination text not null default 'auto'
  check (pnl_denomination in ('auto', 'usd', 'cent'));
