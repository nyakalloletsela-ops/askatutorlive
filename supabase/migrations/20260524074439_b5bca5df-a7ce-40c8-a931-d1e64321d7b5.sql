
create or replace function public.get_session_participant_names()
returns table(user_id uuid, full_name text)
language sql
stable
security definer
set search_path = public
as $$
  select distinct p.id as user_id, p.full_name
  from public.profiles p
  where p.id in (
    select s.tutor_id from public.sessions s where s.student_id = auth.uid()
    union
    select s.student_id from public.sessions s where s.tutor_id = auth.uid()
  );
$$;

grant execute on function public.get_session_participant_names() to authenticated;
