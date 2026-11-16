-- Sandbox (test-mode) subscriptions must not unlock paid features in production.
-- Paddle test checkout is free and its client token is public, so a sandbox subscription proves nothing.
CREATE OR REPLACE FUNCTION public.can_save_projects(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM auth.users u
      WHERE u.id = _user_id
        AND lower(u.email) IN ('christophershivers@synclabsapp.com', 'cbshivers@gmail.com')
    )
    OR public.has_active_subscription(_user_id, 'live');
$$;

GRANT EXECUTE ON FUNCTION public.can_save_projects(uuid) TO anon, authenticated, service_role;