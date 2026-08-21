-- Vector similarity search over journal_embeddings, scoped to the caller.
-- daily_note rows have account_id = null and match every account for that user.
-- Run in Supabase SQL Editor.

create or replace function public.match_journal_embeddings(
  p_account_id uuid,
  p_query_embedding vector(384),
  p_from date default null,
  p_to date default null,
  p_match_count int default 8
)
returns table (
  source_type text,
  source_id uuid,
  content text,
  metadata jsonb,
  similarity float8
)
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Not authenticated';
  end if;

  if p_account_id is not null and not exists (
    select 1 from public.trading_accounts a
    where a.id = p_account_id and a.user_id = uid
  ) then
    raise exception 'Account not found';
  end if;

  return query
    select je.source_type, je.source_id, je.content, je.metadata,
           (1 - (je.embedding <=> p_query_embedding))::float8 as similarity
    from public.journal_embeddings je
    where je.user_id = uid
      and (je.account_id = p_account_id or je.account_id is null)
      and (p_from is null or (je.metadata->>'date')::date >= p_from)
      and (p_to is null or (je.metadata->>'date')::date <= p_to)
    order by je.embedding <=> p_query_embedding
    limit p_match_count;
end;
$$;

revoke all on function public.match_journal_embeddings from public, anon;
grant execute on function public.match_journal_embeddings to authenticated;
