-- Evaluate custom_rules inside refresh_account_risk_eligibility.

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
  custom jsonb;
  c_metric text;
  c_tracks text;
  c_limit numeric;
  c_id text;
  c_pass boolean;
  c_breach int;
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
    if aid is null then continue; end if;

    select ta.risk_track, coalesce(ta.starting_balance, 0), ta.user_id
      into track, start_bal, owner_id
    from public.trading_accounts ta
    where ta.id = aid;

    if not found then continue; end if;

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
        order by date, created_at, id rows unbounded preceding
      ) as c
      from public.trades where account_id = aid
    ) s;

    base := case when start_bal > 0 then start_bal when peak > 0 then peak else 0 end;
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
           case when count(*) = 0 then 0 else (max(date) - min(date)) + 1 end
      into trade_count, days
    from public.trades where account_id = aid;
    days := coalesce(days, 0);
    trade_count := coalesce(trade_count, 0);
    metrics := metrics || jsonb_build_object('history_days', days);
    if coalesce((en->>'history_6m')::boolean, true) and days < hist_min then
      failed := failed || '["history_6m"]'::jsonb;
    end if;

    select coalesce(abs(min(pnl)), 0) / base into daily_pct
    from public.account_daily_stats where account_id = aid and pnl < 0;
    daily_pct := coalesce(daily_pct, 0);
    metrics := metrics || jsonb_build_object('max_daily_loss_pct', daily_pct);
    if coalesce((en->>'daily_loss_1pct')::boolean, true) and daily_pct > daily_max then
      failed := failed || '["daily_loss_1pct"]'::jsonb;
    end if;

    select coalesce(abs(min(c)), 0) / base into overall_pct
    from (
      select sum(coalesce(pnl_usd, 0)) over (
        order by date, created_at, id rows unbounded preceding
      ) as c
      from public.trades where account_id = aid
    ) s where c < 0;
    overall_pct := coalesce(overall_pct, 0);
    metrics := metrics || jsonb_build_object('max_overall_loss_pct', overall_pct);
    if coalesce((en->>'overall_loss_10pct')::boolean, true) and overall_pct > overall_max then
      failed := failed || '["overall_loss_10pct"]'::jsonb;
    end if;

    select coalesce(ats.max_dd, 0) into dd_abs
    from public.account_trade_stats ats where ats.account_id = aid;
    dd_abs := coalesce(dd_abs, 0);
    dd_pct := dd_abs / base;
    metrics := metrics || jsonb_build_object('max_dd_pct', dd_pct);
    if coalesce((en->>'max_dd_10pct')::boolean, true) and dd_pct > dd_max then
      failed := failed || '["max_dd_10pct"]'::jsonb;
    end if;

    select coalesce(abs(sum(coalesce(pnl_usd, 0))) / nullif(count(*), 0), 0) into avg_loss
    from public.trades where account_id = aid and result = 'loss';
    avg_loss := coalesce(avg_loss, 0);

    select count(*)::int into breach_count
    from public.trades t
    where t.account_id = aid
      and (
        case
          when abs(coalesce(t.r_value, 0)) > 0.01 and avg_loss > 0 then abs(t.r_value) * avg_loss
          when t.result = 'loss' then abs(coalesce(t.pnl_usd, 0))
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
        select t.result from public.trades t
        where t.account_id = aid order by t.date, t.created_at, t.id
      loop
        if r = 'loss' then
          streak := streak + 1;
          if streak >= streak_max then streak_fail := true; exit; end if;
        elsif r = 'win' then streak := 0;
        end if;
      end loop;
      metrics := metrics || jsonb_build_object('losing_streak_3', streak_fail);
      if streak_fail then failed := failed || '["losing_streak_3"]'::jsonb; end if;
    end if;

    if track = 'ea' and coalesce((en->>'perf_report_ready')::boolean, true) then
      metrics := metrics || jsonb_build_object('perf_report_ready', trade_count > 0 and days >= 1);
      if not (trade_count > 0 and days >= 1) then
        failed := failed || '["perf_report_ready"]'::jsonb;
      end if;
    end if;

    if cfg.custom_rules is not null and jsonb_typeof(cfg.custom_rules) = 'array' then
      for custom in select * from jsonb_array_elements(cfg.custom_rules)
      loop
        if coalesce((custom->>'enabled')::boolean, true) is not true then continue; end if;
        c_id := custom->>'id';
        c_metric := coalesce(custom->>'metric', 'guideline');
        c_tracks := coalesce(custom->>'tracks', 'both');
        if c_id is null or c_metric = 'guideline' then continue; end if;
        if c_tracks = 'master' and track is distinct from 'master' then continue; end if;
        if c_tracks = 'ea' and track is distinct from 'ea' then continue; end if;

        c_limit := nullif(custom->>'limit', '')::numeric;
        c_pass := true;

        if c_metric = 'history_days' then
          c_pass := c_limit is not null and days >= c_limit;
        elsif c_metric = 'daily_loss_pct' then
          c_pass := c_limit is not null and daily_pct <= c_limit;
        elsif c_metric = 'overall_loss_pct' then
          c_pass := c_limit is not null and overall_pct <= c_limit;
        elsif c_metric = 'max_dd_pct' then
          c_pass := c_limit is not null and dd_pct <= c_limit;
        elsif c_metric = 'risk_per_trade_pct' then
          select count(*)::int into c_breach
          from public.trades t
          where t.account_id = aid
            and (
              case
                when abs(coalesce(t.r_value, 0)) > 0.01 and avg_loss > 0 then abs(t.r_value) * avg_loss
                when t.result = 'loss' then abs(coalesce(t.pnl_usd, 0))
                else null
              end
            ) / base > coalesce(c_limit, 0.01) + 1e-9;
          c_pass := coalesce(c_breach, 0) = 0;
        elsif c_metric = 'losing_streak' then
          if track is distinct from 'master' and c_tracks is distinct from 'both' then continue; end if;
          streak_fail := false;
          streak := 0;
          for r in
            select t.result from public.trades t
            where t.account_id = aid order by t.date, t.created_at, t.id
          loop
            if r = 'loss' then
              streak := streak + 1;
              if streak >= coalesce(c_limit, 3)::int then streak_fail := true; exit; end if;
            elsif r = 'win' then streak := 0;
            end if;
          end loop;
          c_pass := not streak_fail;
        else
          continue;
        end if;

        if not c_pass then
          failed := failed || jsonb_build_array(c_id);
        end if;
      end loop;
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
