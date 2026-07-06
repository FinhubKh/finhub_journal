-- Cascade-delete trades when a trading account is removed
alter table trades drop constraint if exists trades_account_id_fkey;

alter table trades
  add constraint trades_account_id_fkey
  foreign key (account_id) references trading_accounts(id) on delete cascade;
