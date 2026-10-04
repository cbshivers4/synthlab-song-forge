-- has_role is a SECURITY DEFINER helper called inside RLS policies (support_tickets,
-- support_settings, and others). Postgres checks EXECUTE permission when a policy
-- calls the function, so the earlier revoke broke every authenticated query on
-- those tables. Grant it back; SECURITY DEFINER keeps the function itself safe.
grant execute on function public.has_role(uuid, public.app_role) to authenticated;
grant execute on function public.has_role(uuid, public.app_role) to anon;
grant execute on function public.has_role(uuid, public.app_role) to service_role;