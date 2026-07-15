-- ============================================================
-- Performance indexes for journal hot paths
-- Run in Supabase SQL Editor (safe to re-run)
-- ============================================================

create index if not exists trades_user_date_created_idx
  on public.trades (user_id, date desc, created_at desc);

create index if not exists trades_user_account_date_idx
  on public.trades (user_id, account_id, date desc)
  where account_id is not null;

create index if not exists trades_account_id_date_idx
  on public.trades (account_id, date desc)
  where account_id is not null;

create index if not exists trading_accounts_user_default_idx
  on public.trading_accounts (user_id, is_default desc, created_at asc);

create index if not exists trading_accounts_public_published_idx
  on public.trading_accounts (is_public, published_at desc)
  where is_public = true and share_token is not null;

create index if not exists daily_pnl_user_date_idx
  on public.daily_pnl (user_id, date);

create index if not exists checklist_steps_user_position_idx
  on public.checklist_steps (user_id, position);

create index if not exists entry_models_user_created_idx
  on public.entry_models (user_id, created_at asc);

notify pgrst, 'reload schema';
