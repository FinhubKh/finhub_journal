-- Extra SIAC rules admins can add (scored if metric set, else guideline-only).

alter table public.siac_rule_config
  add column if not exists custom_rules jsonb not null default '[]'::jsonb;

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
      }'::jsonb,
      'custom_rules', '[]'::jsonb
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
    'custom_rules', coalesce(row.custom_rules, '[]'::jsonb),
    'updated_at', row.updated_at
  );
end;
$$;

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
  customs jsonb;
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
  customs := coalesce(p_config->'custom_rules', '[]'::jsonb);
  if jsonb_typeof(customs) <> 'array' then
    raise exception 'custom_rules must be an array';
  end if;

  if hist < 1 or hist > 3650 then raise exception 'history_days_min out of range'; end if;
  if daily <= 0 or daily > 1 then raise exception 'daily_loss_max_pct out of range'; end if;
  if overall <= 0 or overall > 1 then raise exception 'overall_loss_max_pct out of range'; end if;
  if dd <= 0 or dd > 1 then raise exception 'max_dd_max_pct out of range'; end if;
  if risk_pt <= 0 or risk_pt > 1 then raise exception 'risk_per_trade_max_pct out of range'; end if;
  if streak < 1 or streak > 50 then raise exception 'losing_streak_max out of range'; end if;

  insert into public.siac_rule_config as c (
    id, history_days_min, daily_loss_max_pct, overall_loss_max_pct,
    max_dd_max_pct, risk_per_trade_max_pct, losing_streak_max,
    enabled_rules, rule_labels, custom_rules, updated_at, updated_by
  ) values (
    1, hist, daily, overall, dd, risk_pt, streak,
    enabled, labels, customs, now(), auth.uid()
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
    custom_rules = excluded.custom_rules,
    updated_at = now(),
    updated_by = auth.uid();

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
