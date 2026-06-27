drop policy if exists "auth user book session" on public.sessions;
drop policy if exists "tutor schedule any student" on public.sessions;
drop policy if exists "tutor schedule existing student" on public.sessions;

create policy "students book tutor sessions"
on public.sessions
for insert
to authenticated
with check (
  auth.uid() = student_id
  and auth.uid() <> tutor_id
  and public.has_role(auth.uid(), 'student'::public.app_role)
  and public.has_role(tutor_id, 'tutor'::public.app_role)
);

create policy "tutors schedule student sessions"
on public.sessions
for insert
to authenticated
with check (
  auth.uid() = tutor_id
  and auth.uid() <> student_id
  and public.has_role(auth.uid(), 'tutor'::public.app_role)
  and public.has_role(student_id, 'student'::public.app_role)
);