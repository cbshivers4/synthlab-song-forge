
drop policy if exists "admins update support settings" on public.support_settings;
drop policy if exists "users read own tickets" on public.support_tickets;

create policy "admins update support settings" on public.support_settings for update to authenticated
  using (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'))
  with check (exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));

create policy "users read own tickets" on public.support_tickets for select to authenticated
  using (user_id = auth.uid() or exists (select 1 from public.user_roles r where r.user_id = auth.uid() and r.role = 'admin'));

revoke execute on function public.has_role(uuid, public.app_role) from public, anon, authenticated;
grant execute on function public.has_role(uuid, public.app_role) to service_role;
