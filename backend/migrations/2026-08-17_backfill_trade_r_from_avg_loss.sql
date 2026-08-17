-- Fill missing R as PnL / average losing trade (same fallback the journal overview uses).
-- Real SL-based R from later EA/bridge syncs overwrites these zeros only when R is known.

update public.trades t
set r_value = round((t.pnl_usd / a.avg_loss)::numeric, 2)
from (
  select
    account_id,
    abs(avg(pnl_usd) filter (where result = 'loss')) as avg_loss
  from public.trades
  where account_id is not null
  group by account_id
) a
where t.account_id = a.account_id
  and a.avg_loss > 0
  and coalesce(t.r_value, 0) = 0
  and t.pnl_usd is not null;

select public.refresh_account_trade_stats(array_agg(id))
from public.trading_accounts;
