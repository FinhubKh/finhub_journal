-- Safe SIAC custom formula evaluator + formula metric in eligibility refresh.
-- Run: supabase db query --linked -f backend/migrations/2026-10-09_siac_formula_expr.sql

create or replace function public.siac_eval_numeric_expr(p_expr text, p_vars jsonb)
returns numeric
language plpgsql
immutable
strict
as $$
declare
  expr text;
  n int;
  i int := 1;
  ch text;
  tok_types text[] := '{}';
  tok_vals text[] := '{}';
  start_i int;
  name text;
  allowed text[] := array[
    'history_days','trade_count','win_rate','profit_factor','total_pnl_pct',
    'daily_loss_pct','overall_loss_pct','max_dd_pct','risk_breaches',
    'wins','losses','gross_win','gross_loss','total_pnl','base'
  ];
  output_t text[] := '{}';
  output_v text[] := '{}';
  op_stack text[] := '{}';
  prec int;
  top_prec int;
  val_stack numeric[] := '{}';
  a numeric;
  b numeric;
  t text;
  v text;
  num numeric;
  top_op text;
  new_types text[];
  new_vals text[];
  prev_tok text;
  k int;
  tt text;
  tv text;
begin
  expr := btrim(coalesce(p_expr, ''));
  n := char_length(expr);
  if n = 0 or n > 200 then
    return null;
  end if;
  if expr !~ '^[0-9a-zA-Z_+\-*/().[:space:]]+$' then
    return null;
  end if;

  -- Tokenize
  while i <= n loop
    ch := substr(expr, i, 1);
    if ch ~ '[[:space:]]' then
      i := i + 1;
      continue;
    end if;
    if ch in ('+', '-', '*', '/', '(', ')') then
      tok_types := tok_types || array['op'];
      tok_vals := tok_vals || array[ch];
      i := i + 1;
      continue;
    end if;
    if ch ~ '[0-9]' then
      start_i := i;
      while i <= n and substr(expr, i, 1) ~ '[0-9]' loop
        i := i + 1;
      end loop;
      if i <= n and substr(expr, i, 1) = '.' then
        i := i + 1;
        if i > n or substr(expr, i, 1) !~ '[0-9]' then
          return null;
        end if;
        while i <= n and substr(expr, i, 1) ~ '[0-9]' loop
          i := i + 1;
        end loop;
      end if;
      tok_types := tok_types || array['num'];
      tok_vals := tok_vals || array[substr(expr, start_i, i - start_i)];
      continue;
    end if;
    if ch ~ '[a-zA-Z_]' then
      start_i := i;
      while i <= n and substr(expr, i, 1) ~ '[a-zA-Z0-9_]' loop
        i := i + 1;
      end loop;
      name := substr(expr, start_i, i - start_i);
      if not (name = any (allowed)) then
        return null;
      end if;
      if p_vars is null or not (p_vars ? name) or jsonb_typeof(p_vars -> name) = 'null' then
        return null;
      end if;
      begin
        num := (p_vars ->> name)::numeric;
      exception when others then
        return null;
      end;
      if num is null then
        return null;
      end if;
      tok_types := tok_types || array['num'];
      tok_vals := tok_vals || array[num::text];
      continue;
    end if;
    return null;
  end loop;

  if coalesce(array_length(tok_types, 1), 0) = 0 then
    return null;
  end if;

  -- Unary +/- : rewrite leading or post-'(' +/− as 0 − x
  new_types := '{}';
  new_vals := '{}';
  prev_tok := '(';
  for k in 1..array_length(tok_types, 1) loop
    tt := tok_types[k];
    tv := tok_vals[k];
    if tt = 'op' and tv in ('+', '-') and prev_tok in ('(', '+', '-', '*', '/') then
      if tv = '-' then
        new_types := new_types || array['num'];
        new_vals := new_vals || array['0'];
        new_types := new_types || array['op'];
        new_vals := new_vals || array['-'];
      end if;
      -- unary plus is skipped
    else
      new_types := new_types || array[tt];
      new_vals := new_vals || array[tv];
    end if;
    if tt = 'op' then
      prev_tok := tv;
    else
      prev_tok := 'n';
    end if;
  end loop;
  tok_types := new_types;
  tok_vals := new_vals;

  -- Shunting-yard → RPN
  for k in 1..coalesce(array_length(tok_types, 1), 0) loop
    t := tok_types[k];
    v := tok_vals[k];
    if t = 'num' then
      output_t := output_t || array['num'];
      output_v := output_v || array[v];
    elsif t = 'op' and v = '(' then
      op_stack := op_stack || array[v];
    elsif t = 'op' and v = ')' then
      while coalesce(array_length(op_stack, 1), 0) > 0 and op_stack[array_length(op_stack, 1)] <> '(' loop
        output_t := output_t || array['op'];
        output_v := output_v || array[op_stack[array_length(op_stack, 1)]];
        op_stack := op_stack[1:array_length(op_stack, 1) - 1];
      end loop;
      if coalesce(array_length(op_stack, 1), 0) = 0 then
        return null;
      end if;
      op_stack := op_stack[1:array_length(op_stack, 1) - 1]; -- pop '('
    elsif t = 'op' then
      prec := case when v in ('+', '-') then 1 when v in ('*', '/') then 2 else 0 end;
      while coalesce(array_length(op_stack, 1), 0) > 0 loop
        top_op := op_stack[array_length(op_stack, 1)];
        if top_op = '(' then exit; end if;
        top_prec := case when top_op in ('+', '-') then 1 when top_op in ('*', '/') then 2 else 0 end;
        if top_prec < prec then exit; end if;
        output_t := output_t || array['op'];
        output_v := output_v || array[top_op];
        op_stack := op_stack[1:array_length(op_stack, 1) - 1];
      end loop;
      op_stack := op_stack || array[v];
    else
      return null;
    end if;
  end loop;

  while coalesce(array_length(op_stack, 1), 0) > 0 loop
    if op_stack[array_length(op_stack, 1)] = '(' then
      return null;
    end if;
    output_t := output_t || array['op'];
    output_v := output_v || array[op_stack[array_length(op_stack, 1)]];
    op_stack := op_stack[1:array_length(op_stack, 1) - 1];
  end loop;

  -- Evaluate RPN
  for k in 1..coalesce(array_length(output_t, 1), 0) loop
    t := output_t[k];
    v := output_v[k];
    if t = 'num' then
      begin
        num := v::numeric;
      exception when others then
        return null;
      end;
      val_stack := val_stack || array[num];
    else
      if coalesce(array_length(val_stack, 1), 0) < 2 then
        return null;
      end if;
      b := val_stack[array_length(val_stack, 1)];
      a := val_stack[array_length(val_stack, 1) - 1];
      val_stack := val_stack[1:array_length(val_stack, 1) - 2];
      if v = '+' then num := a + b;
      elsif v = '-' then num := a - b;
      elsif v = '*' then num := a * b;
      elsif v = '/' then
        if b = 0 then return null; end if;
        num := a / b;
      else
        return null;
      end if;
      if num is null then return null; end if;
      val_stack := val_stack || array[num];
    end if;
  end loop;

  if coalesce(array_length(val_stack, 1), 0) <> 1 then
    return null;
  end if;
  return val_stack[1];
end;
$$;

revoke all on function public.siac_eval_numeric_expr(text, jsonb) from public, anon;
grant execute on function public.siac_eval_numeric_expr(text, jsonb) to authenticated, service_role;

-- Patch refresh: add formula metric branch (full function replace keeps parity with prior migration).
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
  custom_actuals jsonb;
  eligible boolean;
  trade_count int;
  win_count int;
  loss_count int;
  decided int;
  win_rate numeric;
  gross_win numeric;
  gross_loss numeric;
  profit_factor numeric;
  total_pnl numeric;
  total_pnl_pct numeric;
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
  c_op text;
  c_actual numeric;
  c_formula text;
  formula_vars jsonb;
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
    custom_actuals := '{}'::jsonb;
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

    select
      count(*) filter (where result = 'win')::int,
      count(*) filter (where result = 'loss')::int,
      coalesce(sum(coalesce(pnl_usd, 0)) filter (where result = 'win' and pnl_usd > 0), 0),
      coalesce(sum(abs(coalesce(pnl_usd, 0))) filter (where result = 'loss'), 0),
      coalesce(sum(coalesce(pnl_usd, 0)), 0)
    into win_count, loss_count, gross_win, gross_loss, total_pnl
    from public.trades where account_id = aid;

    win_count := coalesce(win_count, 0);
    loss_count := coalesce(loss_count, 0);
    decided := win_count + loss_count;
    win_rate := case when decided > 0 then win_count::numeric / decided else null end;
    profit_factor := case
      when gross_loss > 0 then gross_win / gross_loss
      when gross_win > 0 then null
      else null
    end;
    total_pnl_pct := total_pnl / base;

    metrics := metrics || jsonb_build_object(
      'history_days', days,
      'trade_count', trade_count,
      'win_rate', win_rate,
      'profit_factor', profit_factor,
      'total_pnl_pct', total_pnl_pct
    );
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
        c_op := coalesce(nullif(custom->>'operator', ''), '');
        if c_id is null or c_metric = 'guideline' then continue; end if;
        if c_tracks = 'master' and track is distinct from 'master' then continue; end if;
        if c_tracks = 'ea' and track is distinct from 'ea' then continue; end if;

        c_limit := nullif(custom->>'limit', '')::numeric;
        c_pass := true;
        c_actual := null;

        if c_metric = 'history_days' then
          c_actual := days;
          if c_op = 'lte' then c_pass := c_limit is not null and days <= c_limit;
          else c_pass := c_limit is not null and days >= c_limit;
          end if;
        elsif c_metric = 'trade_count' then
          c_actual := trade_count;
          if c_op = 'lte' then c_pass := c_limit is not null and trade_count <= c_limit;
          else c_pass := c_limit is not null and trade_count >= c_limit;
          end if;
        elsif c_metric = 'win_rate' then
          c_actual := win_rate;
          if win_rate is null or c_limit is null then c_pass := false;
          elsif c_op = 'lte' then c_pass := win_rate <= c_limit;
          else c_pass := win_rate >= c_limit;
          end if;
        elsif c_metric = 'profit_factor' then
          c_actual := profit_factor;
          if c_limit is null then c_pass := false;
          elsif profit_factor is null and gross_win > 0 and gross_loss = 0 then c_pass := true;
          elsif profit_factor is null then c_pass := false;
          elsif c_op = 'lte' then c_pass := profit_factor <= c_limit;
          else c_pass := profit_factor >= c_limit;
          end if;
        elsif c_metric = 'total_pnl_pct' then
          c_actual := total_pnl_pct;
          if c_limit is null then c_pass := false;
          elsif c_op = 'lte' then c_pass := total_pnl_pct <= c_limit;
          else c_pass := total_pnl_pct >= c_limit;
          end if;
        elsif c_metric = 'daily_loss_pct' then
          c_actual := daily_pct;
          if c_op = 'gte' then c_pass := c_limit is not null and daily_pct >= c_limit;
          else c_pass := c_limit is not null and daily_pct <= c_limit;
          end if;
        elsif c_metric = 'overall_loss_pct' then
          c_actual := overall_pct;
          if c_op = 'gte' then c_pass := c_limit is not null and overall_pct >= c_limit;
          else c_pass := c_limit is not null and overall_pct <= c_limit;
          end if;
        elsif c_metric = 'max_dd_pct' then
          c_actual := dd_pct;
          if c_op = 'gte' then c_pass := c_limit is not null and dd_pct >= c_limit;
          else c_pass := c_limit is not null and dd_pct <= c_limit;
          end if;
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
          c_actual := coalesce(c_breach, 0);
          c_pass := coalesce(c_breach, 0) = 0;
        elsif c_metric = 'losing_streak' then
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
          c_actual := case when streak_fail then coalesce(c_limit, 3) else 0 end;
          c_pass := not streak_fail;
        elsif c_metric = 'formula' then
          c_formula := btrim(coalesce(custom->>'formula', ''));
          formula_vars := jsonb_strip_nulls(jsonb_build_object(
            'history_days', days,
            'trade_count', trade_count,
            'win_rate', win_rate,
            'profit_factor', profit_factor,
            'total_pnl_pct', total_pnl_pct,
            'daily_loss_pct', daily_pct,
            'overall_loss_pct', overall_pct,
            'max_dd_pct', dd_pct,
            'risk_breaches', breach_count,
            'wins', win_count,
            'losses', loss_count,
            'gross_win', gross_win,
            'gross_loss', gross_loss,
            'total_pnl', total_pnl,
            'base', base
          ));
          c_actual := public.siac_eval_numeric_expr(c_formula, formula_vars);
          if c_actual is null or c_limit is null then
            c_pass := false;
          elsif c_op = 'lte' then
            c_pass := c_actual <= c_limit;
          else
            c_pass := c_actual >= c_limit;
          end if;
        else
          continue;
        end if;

        if c_actual is not null then
          custom_actuals := custom_actuals || jsonb_build_object(c_id, c_actual);
        end if;

        if not c_pass then
          failed := failed || jsonb_build_array(c_id);
        end if;
      end loop;
    end if;

    metrics := metrics || jsonb_build_object('custom_actuals', custom_actuals);
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
