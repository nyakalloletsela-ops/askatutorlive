
create type help_status as enum ('open','answered','closed');

create table public.help_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid,
  name text not null,
  email text not null,
  subject text not null,
  body text not null,
  status help_status not null default 'open',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.help_messages enable row level security;

create policy "anyone can submit help message"
on public.help_messages for insert
with check (true);

create policy "admins read help messages"
on public.help_messages for select
using (public.has_role(auth.uid(),'admin'));

create policy "admins update help messages"
on public.help_messages for update
using (public.has_role(auth.uid(),'admin'))
with check (public.has_role(auth.uid(),'admin'));

create policy "admins delete help messages"
on public.help_messages for delete
using (public.has_role(auth.uid(),'admin'));

create trigger help_messages_touch
before update on public.help_messages
for each row execute function public.touch_updated_at();
