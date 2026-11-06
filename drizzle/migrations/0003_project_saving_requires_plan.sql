-- Saving projects to the account needs the 14-day trial (card on file), a paid plan, or a founder account.
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
    OR public.has_active_subscription(_user_id, 'live')
    OR public.has_active_subscription(_user_id, 'sandbox');
$$;

REVOKE EXECUTE ON FUNCTION public.can_save_projects(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_save_projects(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription(uuid, text) TO service_role;

DROP POLICY IF EXISTS "Users can create their cloud projects" ON public.cloud_projects;
CREATE POLICY "Users can create their cloud projects"
ON public.cloud_projects FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id AND public.can_save_projects(auth.uid()));

DROP POLICY IF EXISTS "Users can update their cloud projects" ON public.cloud_projects;
CREATE POLICY "Users can update their cloud projects"
ON public.cloud_projects FOR UPDATE TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id AND public.can_save_projects(auth.uid()));