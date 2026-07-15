-- ============================================================
-- One-shot: fix SECURITY DEFINER RPC execute grants
-- Paste into Supabase SQL Editor and Run (safe to re-run)
--
-- Clears anon/public EXECUTE on private RPCs & trigger helpers.
-- Keeps public APIs: get_published_trading_account,
-- get_public_leaderboard, get_leaderboard.
-- Admin/owner RPCs: authenticated only (body still checks role).
--
-- NOTE: "Leaked Password Protection" is Auth Dashboard only —
-- Authentication → Password / Providers → enable HaveIBeenPwned.
-- ============================================================

do $$
declare
  r record;
begin
  for r in
    select
      p.oid::regprocedure as fn,
      case
        when p.proname in (
          'get_published_trading_account',
          'get_public_leaderboard',
          'get_leaderboard'
        ) then 'public_api'
        when p.proname in (
          'admin_platform_stats',
          'admin_list_users',
          'admin_set_user_role',
          'admin_delete_user',
          'set_trading_account_public',
          'is_admin'
        ) then 'auth_only'
        when p.proname in (
          'handle_new_user',
          'prevent_profile_role_escalation',
          'enforce_manual_trade_images'
        ) then 'trigger_only'
        else null
      end as kind
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'admin_platform_stats',
        'admin_list_users',
        'admin_set_user_role',
        'admin_delete_user',
        'set_trading_account_public',
        'is_admin',
        'handle_new_user',
        'prevent_profile_role_escalation',
        'enforce_manual_trade_images',
        'get_published_trading_account',
        'get_public_leaderboard',
        'get_leaderboard'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', r.fn);

    if r.kind = 'public_api' then
      execute format('grant execute on function %s to anon, authenticated', r.fn);
    elsif r.kind = 'auth_only' then
      execute format('grant execute on function %s to authenticated', r.fn);
    end if;
    -- trigger_only: no grant (trigger still runs as owner)
  end loop;
end $$;

notify pgrst, 'reload schema';
