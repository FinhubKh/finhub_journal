-- Fix: allow service role (auth.uid() is null) to promote admins during seeding
create or replace function public.prevent_profile_role_escalation()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() and new.role is distinct from old.role then
    raise exception 'Cannot change role';
  end if;
  return new;
end;
$$;
