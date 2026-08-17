-- Trades uniqueness: (account_id, ticket) so the same broker ticket on two
-- accounts owned by one user does not collide / overwrite.
-- NULLs do not conflict in PostgreSQL unique constraints.

alter table public.trades drop constraint if exists trades_user_id_ticket_key;
drop index if exists public.trades_user_ticket_unique;
drop index if exists public.trades_account_ticket_unique;

-- Keep one row per (account_id, ticket) when duplicates already exist.
with ranked as (
  select
    id,
    row_number() over (
      partition by account_id, ticket
      order by coalesce(close_time, open_time, created_at) desc nulls last, id desc
    ) as rn
  from public.trades
  where account_id is not null
    and ticket is not null
)
delete from public.trades t
using ranked r
where t.id = r.id
  and r.rn > 1;

alter table public.trades
  drop constraint if exists trades_account_id_ticket_key;

alter table public.trades
  add constraint trades_account_id_ticket_key unique (account_id, ticket);
