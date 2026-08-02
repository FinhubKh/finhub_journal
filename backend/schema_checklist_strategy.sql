-- FinhubKH Journal — Strategy-scoped checklist steps
-- Run in Supabase SQL Editor

alter table public.checklist_steps
  add column if not exists entry_model_id uuid references public.entry_models(id) on delete cascade;

create index if not exists checklist_steps_user_model_position_idx
  on public.checklist_steps (user_id, entry_model_id, position);

notify pgrst, 'reload schema';
