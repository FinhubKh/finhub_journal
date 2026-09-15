-- Incremental lock: block client PATCH of computed risk eligibility columns.
-- Apply after 2026-09-15_account_risk_eligibility.sql (or re-run that file's
-- refresh_account_risk_eligibility which now sets finhubkh.allow_risk_refresh).
--
-- If refresh was applied before set_config was added, re-run the CREATE OR REPLACE
-- for public.refresh_account_risk_eligibility from
-- 2026-09-15_account_risk_eligibility.sql before or with this file.

create or replace function public.protect_risk_eligibility_columns()
returns trigger
language plpgsql
as $$
begin
  if current_setting('finhubkh.allow_risk_refresh', true) = 'on' then
    return new;
  end if;
  new.risk_eligible := old.risk_eligible;
  new.risk_failed_rules := old.risk_failed_rules;
  new.risk_metrics := old.risk_metrics;
  new.risk_checked_at := old.risk_checked_at;
  return new;
end;
$$;

drop trigger if exists trg_protect_risk_eligibility on public.trading_accounts;
create trigger trg_protect_risk_eligibility
  before update on public.trading_accounts
  for each row
  execute function public.protect_risk_eligibility_columns();
