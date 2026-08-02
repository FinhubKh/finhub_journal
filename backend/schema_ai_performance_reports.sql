-- FinhubKH Journal — AI performance advisor reports
-- Run in Supabase SQL Editor

create table if not exists ai_performance_reports (
  id              uuid default gen_random_uuid() primary key,
  user_id         uuid references auth.users on delete cascade not null,
  account_id      uuid references trading_accounts(id) on delete cascade not null,
  from_date       date not null,
  to_date         date not null,
  language        text not null default 'en' check (language in ('en', 'km')),
  title           text not null,
  content         jsonb not null,
  stats_snapshot  jsonb,
  created_at      timestamptz default now()
);

create index if not exists ai_performance_reports_user_id_idx
  on ai_performance_reports(user_id);

create index if not exists ai_performance_reports_user_created_idx
  on ai_performance_reports(user_id, created_at desc);

alter table ai_performance_reports enable row level security;

drop policy if exists "Users manage own ai performance reports" on ai_performance_reports;
create policy "Users manage own ai performance reports"
  on ai_performance_reports for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
