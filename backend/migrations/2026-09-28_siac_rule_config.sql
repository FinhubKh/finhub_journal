-- Editable SIAC rule thresholds (singleton config) + admin RPCs.
-- refresh_account_risk_eligibility reads these instead of hardcoded limits.

create table if not exists public.siac_rule_config (
  id int primary key default 1 check (id = 1),
  history_days_min int not null default 182
    check (history_days_min >= 1 and history_days_min <= 3650),
  daily_loss_max_pct numeric not null default 0.01
    check (daily_loss_max_pct > 0 and daily_loss_max_pct <= 1),
  overall_loss_max_pct numeric not null default 0.10
    check (overall_loss_max_pct > 0 and overall_loss_max_pct <= 1),
  max_dd_max_pct numeric not null default 0.10
    check (max_dd_max_pct > 0 and max_dd_max_pct <= 1),
  risk_per_trade_max_pct numeric not null default 0.01
    check (risk_per_trade_max_pct > 0 and risk_per_trade_max_pct <= 1),
  losing_streak_max int not null default 3
    check (losing_streak_max >= 1 and losing_streak_max <= 50),
  enabled_rules jsonb not null default '{
    "history_6m": true,
    "daily_loss_1pct": true,
    "overall_loss_10pct": true,
    "max_dd_10pct": true,
    "risk_per_trade_1pct": true,
    "losing_streak_3": true,
    "perf_report_ready": true
  }'::jsonb,
  rule_labels jsonb not null default '{
    "history_6m": "Trading history ≥ 6 months",
    "daily_loss_1pct": "Max daily loss ≤ 1%",
    "overall_loss_10pct": "Max overall loss ≤ 10%",
    "max_dd_10pct": "Max drawdown ≤ 10%",
    "risk_per_trade_1pct": "Risk per trade ≤ 1%",
    "losing_streak_3": "Losing streak control (no 3+)",
    "perf_report_ready": "Performance report fields available",
    "equity_base_missing": "Equity base available"
  }'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id)
);

insert into public.siac_rule_config (id)
values (1)
on conflict (id) do nothing;

alter table public.siac_rule_config enable row level security;

grant select on public.siac_rule_config to authenticated, anon;
grant all on public.siac_rule_config to service_role;

drop policy if exists "Anyone authenticated can read siac_rule_config" on public.siac_rule_config;
create policy "Anyone authenticated can read siac_rule_config"
  on public.siac_rule_config for select
  to authenticated
  using (true);

drop policy if exists "Anon can read siac_rule_config" on public.siac_rule_config;
create policy "Anon can read siac_rule_config"
  on public.siac_rule_config for select
  to anon
  using (true);

-- Public read of active limits (landing / checklist labels).
create or replace function public.get_siac_rule_config()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.siac_rule_config%rowtype;
begin
  select * into row from public.siac_rule_config where id = 1;
  if not found then
    return jsonb_build_object(
      'history_days_min', 182,
      'daily_loss_max_pct', 0.01,
      'overall_loss_max_pct', 0.10,
      'max_dd_max_pct', 0.10,
      'risk_per_trade_max_pct', 0.01,
      'losing_streak_max', 3,
      'enabled_rules', '{
        "history_6m": true,
        "daily_loss_1pct": true,
        "overall_loss_10pct": true,
        "max_dd_10pct": true,
        "risk_per_trade_1pct": true,
        "losing_streak_3": true,
        "perf_report_ready": true
      }'::jsonb,
      'rule_labels', '{
        "history_6m": "Trading history ≥ 6 months",
        "daily_loss_1pct": "Max daily loss ≤ 1%",
        "overall_loss_10pct": "Max overall loss ≤ 10%",
        "max_dd_10pct": "Max drawdown ≤ 10%",
        "risk_per_trade_1pct": "Risk per trade ≤ 1%",
        "losing_streak_3": "Losing streak control (no 3+)",
        "perf_report_ready": "Performance report fields available",
        "equity_base_missing": "Equity base available"
      }'::jsonb
    );
  end if;
  return jsonb_build_object(
    'history_days_min', row.history_days_min,
    'daily_loss_max_pct', row.daily_loss_max_pct,
    'overall_loss_max_pct', row.overall_loss_max_pct,
    'max_dd_max_pct', row.max_dd_max_pct,
    'risk_per_trade_max_pct', row.risk_per_trade_max_pct,
    'losing_streak_max', row.losing_streak_max,
    'enabled_rules', row.enabled_rules,
    'rule_labels', row.rule_labels,
    'updated_at', row.updated_at
  );
end;
$$;

grant execute on function public.get_siac_rule_config() to anon, authenticated, service_role;
revoke all on function public.get_siac_rule_config() from public;

create or replace function public.admin_update_siac_rule_config(p_config jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  hist int;
  daily numeric;
  overall numeric;
  dd numeric;
  risk_pt numeric;
  streak int;
  enabled jsonb;
  labels jsonb;
  account_ids uuid[];
begin
  if not public.is_admin() then
    raise exception 'Forbidden';
  end if;
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    raise exception 'Invalid config';
  end if;

  hist := coalesce((p_config->>'history_days_min')::int, 182);
  daily := coalesce((p_config->>'daily_loss_max_pct')::numeric, 0.01);
  overall := coalesce((p_config->>'overall_loss_max_pct')::numeric, 0.10);
  dd := coalesce((p_config->>'max_dd_max_pct')::numeric, 0.10);
  risk_pt := coalesce((p_config->>'risk_per_trade_max_pct')::numeric, 0.01);
  streak := coalesce((p_config->>'losing_streak_max')::int, 3);
  enabled := coalesce(p_config->'enabled_rules', '{}'::jsonb);
  labels := coalesce(p_config->'rule_labels', '{}'::jsonb);

  if hist < 1 or hist > 3650 then raise exception 'history_days_min out of range'; end if;
  if daily <= 0 or daily > 1 then raise exception 'daily_loss_max_pct out of range'; end if;
  if overall <= 0 or overall > 1 then raise exception 'overall_loss_max_pct out of range'; end if;
  if dd <= 0 or dd > 1 then raise exception 'max_dd_max_pct out of range'; end if;
  if risk_pt <= 0 or risk_pt > 1 then raise exception 'risk_per_trade_max_pct out of range'; end if;
  if streak < 1 or streak > 50 then raise exception 'losing_streak_max out of range'; end if;

  insert into public.siac_rule_config as c (
    id, history_days_min, daily_loss_max_pct, overall_loss_max_pct,
    max_dd_max_pct, risk_per_trade_max_pct, losing_streak_max,
    enabled_rules, rule_labels, updated_at, updated_by
  ) values (
    1, hist, daily, overall, dd, risk_pt, streak,
    enabled, labels, now(), auth.uid()
  )
  on conflict (id) do update set
    history_days_min = excluded.history_days_min,
    daily_loss_max_pct = excluded.daily_loss_max_pct,
    overall_loss_max_pct = excluded.overall_loss_max_pct,
    max_dd_max_pct = excluded.max_dd_max_pct,
    risk_per_trade_max_pct = excluded.risk_per_trade_max_pct,
    losing_streak_max = excluded.losing_streak_max,
    enabled_rules = excluded.enabled_rules,
    rule_labels = excluded.rule_labels,
    updated_at = now(),
    updated_by = auth.uid();

  -- Re-score every account that has a SIAC track configured.
  select coalesce(array_agg(id), '{}'::uuid[])
    into account_ids
  from public.trading_accounts
  where risk_track is not null;

  if array_length(account_ids, 1) is not null then
    perform public.refresh_account_risk_eligibility(account_ids);
  end if;

  return public.get_siac_rule_config();
end;
$$;

grant execute on function public.admin_update_siac_rule_config(jsonb) to authenticated;
revoke all on function public.admin_update_siac_rule_config(jsonb) from public, anon;

-- Refresh eligibility using live config thresholds / enabled flags.
create or replace function public.refresh_account_risk_eligibility(p_account_ids uuid[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  aid uuid;
  track text;
  start_bal numeric;
  base numeric;
  peak numeric;
  days int;
  daily_pct numeric;
  overall_pct numeric;
  dd_abs numeric;
  dd_pct numeric;
  avg_loss numeric;
  breach_count int;
  streak_fail boolean;
  streak int;
  r text;
  failed jsonb;
  metrics jsonb;
  eligible boolean;
  trade_count int;
  owner_id uuid;
  cfg public.siac_rule_config%rowtype;
  hist_min int;
  daily_max numeric;
  overall_max numeric;
  dd_max numeric;
  risk_max numeric;
  streak_max int;
  en jsonb;
begin
  perform set_config('finhubkh.allow_risk_refresh', 'on', true);

  if p_account_ids is null or array_length(p_account_ids, 1) is null then
    return;
  end if;

  select * into cfg from public.siac_rule_config where id = 1;
  hist_min := coalesce(cfg.history_days_min, 182);
  daily_max := coalesce(cfg.daily_loss_max_pct, 0.01);
  overall_max := coalesce(cfg.overall_loss_max_pct, 0.10);
  dd_max := coalesce(cfg.max_dd_max_pct, 0.10);
  risk_max := coalesce(cfg.risk_per_trade_max_pct, 0.01);
  streak_max := coalesce(cfg.losing_streak_max, 3);
  en := coalesce(cfg.enabled_rules, '{}'::jsonb);

  foreach aid in array p_account_ids loop
    if aid is null then
      continue;
    end if;

    select ta.risk_track, coalesce(ta.starting_balance, 0), ta.user_id
      into track, start_bal, owner_id
    from public.trading_accounts ta
    where ta.id = aid;

    if not found then
      continue;
    end if;

    -- Own accounts, service_role, or admins (e.g. after SIAC config change).
    if auth.uid() is not null
       and current_user is distinct from 'service_role'
       and owner_id is distinct from auth.uid()
       and not public.is_admin() then
      continue;
    end if;

    if track is null then
      update public.trading_accounts set
        risk_eligible = false,
        risk_failed_rules = '[]'::jsonb,
        risk_metrics = '{}'::jsonb,
        risk_checked_at = now()
      where id = aid;
      continue;
    end if;

    select greatest(coalesce(max(c), 0), 0) into peak
    from (
      select sum(coalesce(pnl_usd, 0)) over (
        order by date, created_at, id
        rows unbounded preceding
      ) as c
      from public.trades
      where account_id = aid
    ) s;

    base := case
      when start_bal > 0 then start_bal
      when peak > 0 then peak
      else 0
    end;
    failed := '[]'::jsonb;
    metrics := jsonb_build_object(
      'equity_base', base,
      'peak_equity', peak,
      'limits', jsonb_build_object(
        'history_days_min', hist_min,
        'daily_loss_max_pct', daily_max,
        'overall_loss_max_pct', overall_max,
        'max_dd_max_pct', dd_max,
        'risk_per_trade_max_pct', risk_max,
        'losing_streak_max', streak_max
      )
    );

    if base <= 0 then
      update public.trading_accounts set
        risk_eligible = false,
        risk_failed_rules = '["equity_base_missing"]'::jsonb,
        risk_metrics = metrics,
        risk_checked_at = now()
      where id = aid;
      continue;
    end if;

    select count(*)::int,
           case
             when count(*) = 0 then 0
             else (max(date) - min(date)) + 1
           end
      into trade_count, days
    from public.trades
    where account_id = aid;
    days := coalesce(days, 0);
    trade_count := coalesce(trade_count, 0);
    metrics := metrics || jsonb_build_object('history_days', days);
    if coalesce((en->>'history_6m')::boolean, true) and days < hist_min then
      failed := failed || '["history_6m"]'::jsonb;
    end if;

    select coalesce(abs(min(pnl)), 0) / base into daily_pct
    from public.account_daily_stats
    where account_id = aid
      and pnl < 0;
    daily_pct := coalesce(daily_pct, 0);
    metrics := metrics || jsonb_build_object('max_daily_loss_pct', daily_pct);
    if coalesce((en->>'daily_loss_1pct')::boolean, true) and daily_pct > daily_max then
      failed := failed || '["daily_loss_1pct"]'::jsonb;
    end if;

    select coalesce(abs(min(c)), 0) / base into overall_pct
    from (
      select sum(coalesce(pnl_usd, 0)) over (
        order by date, created_at, id
        rows unbounded preceding
      ) as c
      from public.trades
      where account_id = aid
    ) s
    where c < 0;
    overall_pct := coalesce(overall_pct, 0);
    metrics := metrics || jsonb_build_object('max_overall_loss_pct', overall_pct);
    if coalesce((en->>'overall_loss_10pct')::boolean, true) and overall_pct > overall_max then
      failed := failed || '["overall_loss_10pct"]'::jsonb;
    end if;

    select coalesce(ats.max_dd, 0) into dd_abs
    from public.account_trade_stats ats
    where ats.account_id = aid;
    dd_abs := coalesce(dd_abs, 0);
    dd_pct := dd_abs / base;
    metrics := metrics || jsonb_build_object('max_dd_pct', dd_pct);
    if coalesce((en->>'max_dd_10pct')::boolean, true) and dd_pct > dd_max then
      failed := failed || '["max_dd_10pct"]'::jsonb;
    end if;

    select coalesce(
      abs(sum(coalesce(pnl_usd, 0))) / nullif(count(*), 0),
      0
    ) into avg_loss
    from public.trades
    where account_id = aid
      and result = 'loss';
    avg_loss := coalesce(avg_loss, 0);

    select count(*)::int into breach_count
    from public.trades t
    where t.account_id = aid
      and (
        case
          when abs(coalesce(t.r_value, 0)) > 0.01 and avg_loss > 0
            then abs(t.r_value) * avg_loss
          when t.result = 'loss'
            then abs(coalesce(t.pnl_usd, 0))
          else null
        end
      ) / base > risk_max + 1e-9;
    breach_count := coalesce(breach_count, 0);
    metrics := metrics || jsonb_build_object('risk_per_trade_breaches', breach_count);
    if coalesce((en->>'risk_per_trade_1pct')::boolean, true) and breach_count > 0 then
      failed := failed || '["risk_per_trade_1pct"]'::jsonb;
    end if;

    if track = 'master' and coalesce((en->>'losing_streak_3')::boolean, true) then
      streak_fail := false;
      streak := 0;
      for r in
        select t.result
        from public.trades t
        where t.account_id = aid
        order by t.date, t.created_at, t.id
      loop
        if r = 'loss' then
          streak := streak + 1;
          if streak >= streak_max then
            streak_fail := true;
            exit;
          end if;
        elsif r = 'win' then
          streak := 0;
        end if;
      end loop;
      metrics := metrics || jsonb_build_object('losing_streak_3', streak_fail);
      if streak_fail then
        failed := failed || '["losing_streak_3"]'::jsonb;
      end if;
    end if;

    if track = 'ea' and coalesce((en->>'perf_report_ready')::boolean, true) then
      metrics := metrics || jsonb_build_object(
        'perf_report_ready',
        trade_count > 0 and days >= 1
      );
      if not (trade_count > 0 and days >= 1) then
        failed := failed || '["perf_report_ready"]'::jsonb;
      end if;
    end if;

    eligible := jsonb_array_length(failed) = 0;
    update public.trading_accounts set
      risk_eligible = eligible,
      risk_failed_rules = failed,
      risk_metrics = metrics,
      risk_checked_at = now()
    where id = aid;
  end loop;
end;
$$;

revoke all on function public.refresh_account_risk_eligibility(uuid[]) from public, anon;
grant execute on function public.refresh_account_risk_eligibility(uuid[]) to authenticated, service_role;
