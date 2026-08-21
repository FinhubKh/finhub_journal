-- Vector storage for trade/daily journal notes (AI Advisor RAG).
-- Run in Supabase SQL Editor.

create extension if not exists vector;

create table if not exists public.journal_embeddings (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  account_id   uuid references public.trading_accounts on delete cascade,
  source_type  text not null check (source_type in ('trade', 'daily_note')),
  source_id    uuid not null,
  content      text not null,
  embedding    vector(384) not null,
  metadata     jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (source_type, source_id)
);

create index if not exists journal_embeddings_user_account_idx
  on public.journal_embeddings (user_id, account_id);

create index if not exists journal_embeddings_embedding_idx
  on public.journal_embeddings using hnsw (embedding vector_cosine_ops);

alter table public.journal_embeddings enable row level security;

drop policy if exists "Users can view own journal embeddings" on public.journal_embeddings;
create policy "Users can view own journal embeddings"
  on public.journal_embeddings for select using (auth.uid() = user_id);

-- No insert/update/delete policy for authenticated/anon on purpose:
-- writes only happen via the service-role edge function (see Task 5),
-- which bypasses RLS. Direct client writes are blocked by default-deny.
