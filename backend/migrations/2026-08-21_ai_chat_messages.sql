-- Persistent AI Advisor chat history, per account.
-- Run in Supabase SQL Editor.

create table if not exists public.ai_chat_messages (
  id          uuid default gen_random_uuid() primary key,
  user_id     uuid references auth.users on delete cascade not null,
  account_id  uuid references public.trading_accounts on delete cascade not null,
  role        text not null check (role in ('user', 'assistant')),
  content     text not null,
  created_at  timestamptz not null default now()
);

create index if not exists ai_chat_messages_user_account_created_idx
  on public.ai_chat_messages (user_id, account_id, created_at);

alter table public.ai_chat_messages enable row level security;

drop policy if exists "Users manage own ai chat messages" on public.ai_chat_messages;
create policy "Users manage own ai chat messages"
  on public.ai_chat_messages for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
