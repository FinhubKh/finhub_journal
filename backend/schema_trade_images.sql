-- ============================================================
-- FinhubKH Journal — Trade screenshots (manual trades only)
-- Run in Supabase SQL Editor
-- ============================================================

create table if not exists trade_images (
  id           uuid default gen_random_uuid() primary key,
  user_id      uuid references auth.users on delete cascade not null,
  trade_id     uuid references public.trades on delete cascade not null,
  storage_path text not null,
  label        text not null default 'Entry'
               check (label in ('Entry', 'HTF', 'Exit', 'Other')),
  file_name    text,
  content_type text,
  created_at   timestamptz default now(),
  unique (trade_id, storage_path)
);

create index if not exists trade_images_trade_id_idx on trade_images(trade_id);
create index if not exists trade_images_user_id_idx on trade_images(user_id);

alter table trade_images enable row level security;

drop policy if exists "Users can view own trade images" on trade_images;
create policy "Users can view own trade images"
  on trade_images for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own trade images" on trade_images;
create policy "Users can insert own trade images"
  on trade_images for insert with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.trades t
      where t.id = trade_id
        and t.user_id = auth.uid()
        and coalesce(t.source, 'manual') = 'manual'
    )
  );

drop policy if exists "Users can update own trade images" on trade_images;
create policy "Users can update own trade images"
  on trade_images for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own trade images" on trade_images;
create policy "Users can delete own trade images"
  on trade_images for delete using (auth.uid() = user_id);

-- Block attaching images to synced API trades
create or replace function public.enforce_manual_trade_images()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  trade_source text;
begin
  select coalesce(source, 'manual') into trade_source
  from public.trades
  where id = new.trade_id and user_id = new.user_id;

  if trade_source is null then
    raise exception 'Trade not found';
  end if;
  if trade_source <> 'manual' then
    raise exception 'Screenshots are only allowed on manual trades';
  end if;
  return new;
end;
$$;

drop trigger if exists trade_images_manual_only on trade_images;
create trigger trade_images_manual_only
  before insert or update on trade_images
  for each row execute function public.enforce_manual_trade_images();

revoke all on function public.enforce_manual_trade_images() from public, anon, authenticated;

-- Storage bucket (private)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'trade-screenshots',
  'trade-screenshots',
  false,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path shape: {user_id}/{trade_id}/{filename}
drop policy if exists "Users can upload own trade screenshots" on storage.objects;
create policy "Users can upload own trade screenshots"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can read own trade screenshots" on storage.objects;
create policy "Users can read own trade screenshots"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can update own trade screenshots" on storage.objects;
create policy "Users can update own trade screenshots"
  on storage.objects for update to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users can delete own trade screenshots" on storage.objects;
create policy "Users can delete own trade screenshots"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'trade-screenshots'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
