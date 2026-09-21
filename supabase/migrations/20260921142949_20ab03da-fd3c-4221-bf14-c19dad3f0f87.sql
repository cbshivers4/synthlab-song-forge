
do $$ begin
  if not exists (select 1 from pg_type where typname = 'app_role') then
    create type public.app_role as enum ('admin','moderator','user');
  end if;
end $$;

create table if not exists public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role public.app_role not null,
  created_at timestamptz not null default now(),
  unique (user_id, role)
);
grant select on public.user_roles to authenticated;
grant all on public.user_roles to service_role;
alter table public.user_roles enable row level security;
create policy "users read own roles" on public.user_roles for select to authenticated using (user_id = auth.uid());

create or replace function public.has_role(_user_id uuid, _role public.app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

insert into public.user_roles (user_id, role)
select id, 'admin'::public.app_role from auth.users where lower(email) = 'cbshivers@gmail.com'
on conflict (user_id, role) do nothing;

create table if not exists public.support_settings (
  id boolean primary key default true check (id),
  support_email text not null default '',
  support_website text not null default '',
  help_center_url text not null default '',
  knowledge_base_url text not null default '',
  terms_url text not null default '/terms',
  privacy_url text not null default '/privacy',
  status_url text not null default '',
  community_url text not null default '',
  tutorials_url text not null default '',
  updated_at timestamptz not null default now()
);
insert into public.support_settings (id) values (true) on conflict (id) do nothing;
grant select on public.support_settings to anon;
grant select on public.support_settings to authenticated;
grant all on public.support_settings to service_role;
alter table public.support_settings enable row level security;
create policy "anyone reads support settings" on public.support_settings for select to anon, authenticated using (true);
create policy "admins update support settings" on public.support_settings for update to authenticated
  using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));
grant update on public.support_settings to authenticated;

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  kind text not null default 'support',
  name text not null default '',
  email text not null default '',
  category text not null default 'Other',
  subject text not null default '',
  description text not null default '',
  expected text not null default '',
  steps text not null default '',
  project_name text not null default '',
  diagnostics jsonb not null default '{}'::jsonb,
  status text not null default 'open',
  created_at timestamptz not null default now()
);
grant select, insert on public.support_tickets to authenticated;
grant all on public.support_tickets to service_role;
alter table public.support_tickets enable row level security;
create policy "users create own tickets" on public.support_tickets for insert to authenticated with check (user_id = auth.uid());
create policy "users read own tickets" on public.support_tickets for select to authenticated using (user_id = auth.uid() or public.has_role(auth.uid(),'admin'));
