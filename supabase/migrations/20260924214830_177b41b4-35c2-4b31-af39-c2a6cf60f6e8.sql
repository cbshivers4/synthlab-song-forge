DROP POLICY IF EXISTS "signed-in users read support settings" ON public.support_settings;
CREATE POLICY "admins read support settings"
ON public.support_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));